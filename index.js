import fs from 'fs';
import { Platform, Innertube } from 'youtubei.js';
import ytdl from "@distube/ytdl-core";
import { fetch, ProxyAgent } from 'undici';

export class YouTubeVideoDownload extends plugin {
    constructor() {
        super({
            name: 'YT视频下载',
            dsc: 'YouTube视频下载',
            event: 'message',
            priority: 100,
            rule: [
                {
                    reg: '(?:youtu\\.be\\/|youtube\\.com\\/)',
                    fnc: 'parse_youtube'
                },
                {
                    reg: '#ytdl代理(.*)',
                    fnc: 'set_proxy',
                    permission: "master"
                },
                {
                    reg: '#ytdlwsl(.*)',
                    fnc: 'set_wsl',
                    permission: "master"
                },
                {
                    reg: '#ytdl超时(.*)',  // 秒
                    fnc: 'set_fetch_timeout',
                    permission: "master"
                },
                {
                    reg: '#ytdl拉黑(.*)',  // qq号
                    fnc: 'set_banned_qqs',
                    permission: "master"
                },
                {
                    reg: '#ytdl取消拉黑(.*)',
                    fnc: 'unban_qqs',
                    permission: "master"
                }
            ]
        });

        this.config = {
            path: './plugins/yunzai-yt-dl-plugin/config.json',
            timeout: 300,  // 秒
            proxy: null,
            wsl: '',
            banned_qqs: []
        };

        this.proxy_dispatcher = null;
        this._init();
    }

    _init() {
        if (!fs.existsSync(this.config.path)) {
            fs.writeFileSync(this.config.path, JSON.stringify({}, null, 4));
            logger.info('[ytdl] 配置文件不存在，已创建空文件');
            return;
        }

        try {
            const config = JSON.parse(fs.readFileSync(this.config.path, 'utf-8'));
            if (config.proxy) {
                this._set_proxy(config.proxy);
            }
            this.config.wsl = config.wsl ?? '';
            this.config.timeout = config.fetch_timeout ?? 300;
            this.config.banned_qqs = config.banned_qqs ?? [];
        } catch (error) {
            logger.error('[ytdl] YT视频下载: 读取配置失败:', error);
        }
    }

    async _handle_blacklist(e, action = 'ban') {
        const command = action === 'ban' ? '#ytdl拉黑' : '#ytdl取消拉黑';
        const input = e.msg.match(new RegExp(`${command}\\s*(.*)`, 'i'))?.[1]?.trim();

        try {
            if (!input) {
                // 如果没有输入参数，显示当前拉黑列表
                const list = this.config.banned_qqs.length > 0
                    ? this.config.banned_qqs.join(', ')
                    : '无';
                e.reply(`当前拉黑名单：${list}`);
                return;
            }

            // 解析和验证QQ号
            const qq_numbers = input.split(/[,，\s]+/)
                .map(qq => qq.trim())
                .filter(qq => qq.length > 0);

            for (const qq of qq_numbers) {
                if (!/^\d{5,}$/.test(qq)) {
                    throw new Error(`无效的QQ号格式: ${qq}`);
                }
            }

            // 更新拉黑列表
            const current_list = new Set(this.config.banned_qqs);
            let changed = [];

            for (const qq of qq_numbers) {
                if (action === 'ban' && !current_list.has(qq)) {
                    current_list.add(qq);
                    changed.push(qq);
                } else if (action === 'unban' && current_list.has(qq)) {
                    current_list.delete(qq);
                    changed.push(qq);
                }
            }

            if (changed.length === 0) {
                const msg = action === 'ban' ? '已在拉黑名单中' : '不在拉黑名单中';
                e.reply(`指定的QQ号${msg}`);
                return;
            }

            // 保存更新后的列表
            const new_list = Array.from(current_list);
            await this._save_config({ banned_qqs: new_list });

            const action_msg = action === 'ban' ? '添加到' : '从';
            let reply = `已${action_msg}拉黑名单${action === 'ban' ? '' : '移除'}: ${changed.join(', ')}\n`;
            reply += `当前拉黑名单：${new_list.length > 0 ? new_list.join(', ') : '无'}`;

            e.reply(reply);
        } catch (error) {
            const err_msg = action === 'ban' ? '设置拉黑名单失败' : '取消拉黑失败';
            e.reply(`${err_msg}: ${error.message}`);
        }
    }

    async set_banned_qqs(e) {
        return this._handle_blacklist(e, 'ban');
    }

    async unban_qqs(e) {
        return this._handle_blacklist(e, 'unban');
    }

    async _save_config(updates = {}) {
        try {
            const config = { ...this.config, ...updates };
            await fs.promises.writeFile(this.config.path, JSON.stringify(config, null, 4));
            Object.assign(this.config, updates);
        } catch (error) {
            throw new Error(`保存配置失败: ${error.message}`);
        }
    }

    async set_fetch_timeout(e) {
        const timeout_str = e.msg.match(/#ytdl超时\s*(.*)/i)?.[1]?.trim();

        try {
            const timeout = parseInt(timeout_str);

            if (isNaN(timeout) || timeout <= 0) {
                throw new Error('超时时间必须是大于0的数字');
            }

            await this._save_config({ timeout });

            if (this.proxy_dispatcher) {
                this.proxy_dispatcher = new ProxyAgent({
                    uri: this.config.proxy,
                    timeout: timeout * 1000
                });
            }

            e.reply(`已设置超时时间为 ${timeout} 秒`);
        } catch (error) {
            e.reply(`设置超时失败: ${error.message}`);
        }
    }

    _set_proxy(proxy_url) {
        try {
            if (!proxy_url) {
                this.proxy_dispatcher = null;
                this.config.proxy = null;
                return true;
            }

            const url = new URL(proxy_url);
            if (!['http:', 'https:'].includes(url.protocol)) {
                throw new Error('代理地址协议无效，仅支持 http 或 https');
            }

            this.config.proxy = proxy_url;
            this.proxy_dispatcher = new ProxyAgent({
                uri: proxy_url,
                timeout: this.config.timeout * 1000
            });

            return true;
        } catch (error) {
            logger.error('[ytdl] YT视频下载: 设置代理失败:', error);
            return false;
        }
    }

    async set_proxy(e) {
        const proxy_url = e.msg.match(/#ytdl代理\s*(.*)/i)?.[1]?.trim();

        try {
            if (this._set_proxy(proxy_url)) {
                await this._save_config({ proxy: proxy_url });
                e.reply(proxy_url ? `代理已设置为: ${proxy_url}` : '已清除代理设置');
            } else {
                e.reply('设置代理失败，请检查格式。\n格式：http://IP:端口');
            }
        } catch (error) {
            e.reply(`设置代理失败: ${error.message}`);
        }
    }

    async set_wsl(e) {
        try {
            const wsl_path = e.msg.match(/^#ytdlwsl\s*(.*)/)?.[1]?.trim() ?? '';
            await this._save_config({ wsl: wsl_path });
            e.reply(wsl_path ? `已设置 WSL 路径为: ${wsl_path}` : "已清除 WSL 设置");
        } catch (error) {
            logger.error("[ytdl] 设置 WSL 失败:", error);
            e.reply("设置 WSL 失败，请检查日志");
        }
    }

    _get_video_id(msg) {
        const match = msg.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|user\/[^#]+\/u\/\d\/|v=))([a-zA-Z0-9_-]{11})/);
        if (!match?.[1]) throw new Error('无效的YouTube视频ID');
        return match[1];
    }

    async _init_youtube() {
        return await Innertube.create({
            fetch: (input, init) => Platform.shim.fetch(input, {
                ...init,
                dispatcher: this.proxy_dispatcher
            })
        });
    }

    async _download_thumbnail_as_buffer(url) {
        try {
            const options = {};
            if (this.proxy_dispatcher) {
                options.dispatcher = this.proxy_dispatcher;
            }

            const response = await fetch(url, options);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return Buffer.from(await response.arrayBuffer());
        } catch (error) {
            throw error.name === 'AbortError' ?
                new Error('[ytdl] 下载缩图超时') :
                new Error(`下载缩图失败: ${error.message}`);
        }
    }

    async parse_youtube(e) {
        if (e.user_id === e.self_id) return;

        if (this.config.banned_qqs.includes(e.user_id.toString())) {
            logger.info(`[ytdl] QQ ${e.user_id} 已忽略，原因：被拉黑`);
            return;
        }

        try {
            e.reply('正在解析YouTube视频，请稍等');
            const video_id = this._get_video_id(e.msg);
            const yt = await this._init_youtube();
            const video = await yt.getInfo(video_id);

            try {
                const img = await this._download_thumbnail_as_buffer(video.basic_info.thumbnail[0].url);
                await e.reply(segment.image(img));
            } catch (error) {
                logger.error(`[ytdl] 获取视频缩略图失败: ${error.message}`);
                await e.reply('获取视频缩略图失败，继续尝试下载');
            }

            const options = {};
            if (this.config.proxy) {
                options.agent = ytdl.createProxyAgent({ uri: this.config.proxy });
            }

            const ytdl_info = await ytdl.getInfo(video_id, options);

            await e.reply(
                `标题: ${video.basic_info.title}\n` +
                `👀: ${video.basic_info.view_count} 👍: ${video.basic_info.like_count}\n` +
                `发布日期: ${video.primary_info.published}\n` +
                `描述: ${video.basic_info.short_description}\n\n` +
                `------\n` +
                `作者: ${video.basic_info.author || '未知'}\n` +
                `订阅数: ${ytdl_info.videoDetails.author.subscriber_count || '未知'}`
            );

            const video_path = `./temp/ytdl/${video_id}.mp4`;

            try {
                // 确保下载目录存在
                await fs.promises.mkdir('./temp/ytdl', { recursive: true });

                // 检查视频文件是否存在
                const fileExists = await fs.promises.access(video_path)
                    .then(() => true)
                    .catch(() => false);

                if (!fileExists) {
                    logger.info(`[ytdl] 视频 ${video_id} 不存在，开始下载...`);
                    await this._download_video(yt, video_id, video_path);
                } else {
                    logger.info(`[ytdl] 视频 ${video_id} 已存在，跳过下载`);
                }
            } catch (error) {
                logger.error('[ytdl] 创建下载目录失败:', error);
                throw new Error('创建下载目录失败');
            }

            // 根据 WSL 配置生成最终路径
            let final_path = '';
            if (this.config.wsl) {
                final_path = `${this.config.wsl}${process.cwd()}/temp/ytdl/${video_id}.mp4`;
            } else {
                final_path = `file://${process.cwd()}/temp/ytdl/${video_id}.mp4`;
            }

            await e.reply(segment.video(final_path));
            setTimeout(async () => {
                try {
                    await fs.promises.unlink(`./temp/ytdl/${video_id}.mp4`);
                    logger.info(`[ytdl] 视频文件 ${video_id} 已被清理`);
                } catch (error) {
                    logger.warn(`[ytdl] 清理视频文件 ${video_id} 失败:`, error);
                }
            }, this.config.timeout);
        } catch (error) {
            let msg = `处理失败: ${error.message}`
            if (error.message === 'fetch failed') {
                msg += `\n当前代理: ${this.config.proxy}\n使用 #ytdl代理[HTTP代理] 来指定代理`
            }
            e.reply(msg);
            logger.error('[ytdl] YT视频下载错误:', error);
        }
    }

    async _download_video(yt, video_id, path) {
        const stream = await yt.download(video_id, {
            type: 'video+audio',
            quality: 'best',
            format: 'mp4',
            client: 'WEB'
        });

        // todo: 分别下载画面和音轨并合成高画质视频

        const writer = fs.createWriteStream(path);
        const reader = stream.getReader();

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                writer.write(Buffer.from(value));
            }
            writer.end();

            return new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });
        } catch (error) {
            writer.end();
            throw new Error(`视频下载失败: ${error.message}`);
        }
    }
}

