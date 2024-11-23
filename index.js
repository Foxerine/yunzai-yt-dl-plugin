import fs from 'fs';
import path from "path";
import { Platform, Innertube, UniversalCache} from 'youtubei.js';
import ytdl from "@distube/ytdl-core";
import { fetch, ProxyAgent } from 'undici';

export class YouTubeVideoDownload extends plugin {
    constructor() {
        super({
            name: 'YT视频下载',
            dsc: 'YouTube视频下载',
            event: 'message',
            priority: 100,
            rule: [{
                reg: '(?:youtu\\.be\\/|youtube\\.com\\/)',
                fnc: 'parse_youtube'
            }, {
                reg: '#ytdl代理(.*)',
                fnc: 'set_proxy',
                permission: "master",
            }, {
                reg: '^#ytdlwsl',
                fnc: 'set_wsl',
                permission: "master",
            }, /*{
                reg: '#ytdl超时(.*)',
                fnc: 'set_timeout',
                permission: "master",
            }*/]
        });

        this.timeout = 300;
        this.proxy_dispatcher = null;
        this.proxy_uri = null;
        this.config_path = './plugins/yunzai-yt-dl-plugin/config.json';
        this.wsl = false
        this.read_config()
    }
    _set_proxy(proxy_url) {
        try {
            const config_path = this.config_path;

            // 读取现有配置文件内容
            let config = {};
            if (fs.existsSync(config_path)) {
                try {
                    config = JSON.parse(fs.readFileSync(config_path, 'utf-8'));
                } catch (error) {
                    throw new Error(`读取配置文件失败: ${error.message}`);
                }
            }

            if (!proxy_url) {
                // 重置代理并清空 "proxy" 字段
                this.proxy_dispatcher = null;
                this.proxy_uri = null;
                delete config.proxy;
                logger.info('YT视频下载: 代理已重置为默认配置');
            } else {
                // 校验代理地址格式
                const url = new URL(proxy_url);
                const supportedProtocols = ['http:', 'https:'];
                if (!supportedProtocols.includes(url.protocol)) {
                    throw new Error('代理地址协议无效，仅支持 http 或 https');
                }

                // 设置代理
                this.proxy_uri = proxy_url;
                this.proxy_dispatcher = new ProxyAgent({
                    uri: proxy_url,
                    timeout: this.timeout * 1000
                });

                config.proxy = proxy_url;
                logger.info('YT视频下载: 代理已成功设置为:', proxy_url);
            }

            // 写回文件
            try {
                fs.writeFileSync(config_path, JSON.stringify(config, null, 4));
            } catch (error) {
                throw new Error(`更新配置文件失败: ${error.message}`);
            }
        } catch (error) {
            logger.error('YT视频下载: 设置代理时出现错误:', error);
        }
    }

    read_config() {
        try {
            const config_path = this.config_path;

            // 检查配置文件是否存在
            if (!fs.existsSync(config_path)) {
                fs.writeFileSync(config_path, JSON.stringify({}, null, 4));
                logger.info('YT视频下载: 配置文件不存在，已创建空文件');
                return;
            }

            // 读取并解析 JSON 文件
            let config = {};
            try {
                config = JSON.parse(fs.readFileSync(config_path, 'utf-8'));
            } catch (error) {
                throw new Error(`读取配置文件失败: ${error.message}`);
            }

            // 获取 "proxy" 字段的值
            const proxy_url = config.proxy;

            if (!proxy_url) {
                logger.info('YT视频下载: 配置文件为空，将使用默认配置');
            } else {
                // 设置代理
                try {
                    this._set_proxy(proxy_url)
                    logger.info('YT视频下载: 已从配置文件设置代理:', proxy_url);
                } catch (error) {
                    throw new Error(`设置代理失败: ${error.message}`);
                }
            }

            // 获取 "wsl" 字段的值
            if ('wsl' in config) {
                this.wsl = config.wsl;
                logger.info('YT视频下载: 已从配置文件设置 WSL:', this.wsl);
            } else {
                logger.info('YT视频下载: 配置文件中未找到 WSL 字段，将使用默认值');
            }

        } catch (err) {
            logger.error('YT视频下载: 初始化代理和 WSL 设置时出现错误:', err);
        }
    }

    async set_wsl(e) {
        try {
            const config_path = this.config_path;

            // 切换 wsl 状态
            this.wsl = !this.wsl;

            // 读取现有配置文件内容
            let config = {};
            if (fs.existsSync(config_path)) {
                try {
                    config = JSON.parse(fs.readFileSync(config_path, 'utf-8'));
                } catch (error) {
                    throw new Error(`读取配置文件失败: ${error.message}`);
                }
            }

            // 更新配置文件中的 wsl 字段
            config.wsl = this.wsl;

            // 写回更新后的配置
            try {
                fs.writeFileSync(config_path, JSON.stringify(config, null, 4));
            } catch (error) {
                throw new Error(`更新配置文件失败: ${error.message}`);
            }

            // 回复用户
            if (this.wsl) {
                e.reply("已设置 wsl");
            } else {
                e.reply("已取消 wsl 设置");
            }
        } catch (error) {
            logger.error("设置 wsl 时出现错误:", error);
            e.reply("设置 wsl 时出现错误，请检查日志");
        }
    }

    async set_proxy(e) {
        const regex = /#ytdl代理\s*(.*)/i;
        const matches = e.msg.match(regex);

        if (!matches || !matches[1]) {
            e.reply('请提供正确的代理地址，格式：#ytdl代理 http://host:port 或 https://host:port');
            return;
        }

        const proxyUrl = matches[1].trim();

        try {
            // 设置代理并自动保存到文件
            this._set_proxy(proxyUrl);
            e.reply(`代理已设置为: ${proxyUrl}`);
            logger.info('YT视频下载: 代理已更新:', proxyUrl);
        } catch (err) {
            e.reply(`设置代理失败: ${err.message}`);
            logger.error('YT视频下载: 设置代理失败:', err);
        }
    }

    async parse_youtube(e) {
        if (e.user_id === e.self_id) {
            return;
        }

        e.reply('正在解析YouTube视频，请稍等');

        const getVideoID = (msg) => {
            const videoIDRegex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|user\/[^#]+\/u\/\d\/|v=))([a-zA-Z0-9_-]{11})/;
            const match = msg.match(videoIDRegex);
            if (match && match[1]) {
                return match[1];
            }
            throw new Error('无效的YouTube视频ID');
        };

        let video_id;
        try {
            video_id = getVideoID(e.msg);
        } catch (exec) {
            e.reply('解析失败: ' + exec.message);
            return;
        }

        let yt, dispatcher = this.proxy_dispatcher;
        try {
            yt = await Innertube.create({
                fetch(input, init) {
                return Platform.shim.fetch(input, {
                    ...init,
                    dispatcher: dispatcher
                })
            }
        });

        } catch (exec) {
            e.reply('创建 YouTube 客户端失败: ' + exec.message);
            throw exec;
        }

        let video;
        try {
            logger.info('正在获取视频信息: ' + video_id);
            video = await yt.getInfo(video_id);
        } catch (exec) {
            e.reply('获取视频信息失败: ' + (exec.message || exec) + '，请检查代理设置');
            return;
        }

        const thumbnail_url = video.basic_info.thumbnail[0].url;

        let img;
        // 创建目录（如果不存在）
        try {
            img = await this.download_thumbnail_as_buffer(thumbnail_url);
            e.reply(segment.image(img));
        } catch (exec) {
            e.reply('下载缩图失败: ' + (exec.message || exec));
            return;
        }
        let ytdl_info;
        try {
            const agent = ytdl.createProxyAgent({ uri: this.proxy_uri });
            ytdl_info = await ytdl.getInfo(video_id, {agent});
        } catch (exec) {
            logger.info("部分信息获取失败")
            throw exec;
        }


        try {
            const info_reply = `标题: ${video.basic_info.title}
👀: ${video.basic_info.view_count} 👍: ${video.basic_info.like_count}
发布日期: ${video.primary_info.published}
描述: ${video.basic_info.short_description}

------
作者: ${video.basic_info.author || '未知'}
订阅数: ${ytdl_info.videoDetails.author.subscriber_count || null}`;
            e.reply(info_reply);
        } catch (err) {
            logger.error('获取视频信息失败:', err);
            e.reply("获取视频信息失败")
        }

        try {
            const stream = await yt.download(video_id, {
                type: 'video+audio',
                quality: 'best',
                format: 'mp4',
                client: 'WEB',
            });

            fs.unlink('./temp/ytdl.mp4', (err) => {
                if (err) {
                    logger.info('删除上一次的临时文件失败:', err);
                } else {
                    logger.info('上一次的临时文件已成功删除');
                }
            });

            const fileStream = fs.createWriteStream('./temp/ytdl.mp4');
            const reader = stream.getReader();
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                fileStream.write(Buffer.from(value));
            }
            fileStream.end();
            let video_path = segment.video('file://' + process.cwd() + '/temp/ytdl.mp4')
            if (this.wsl) {
                video_path = "//wsl.localhost/Arch/root/TRSS_AllBot/TRSS-Yunzai/temp/ytdl.mp4"
            }

            e.reply(segment.video(video_path));

        } catch (exec) {
            e.reply('下载视频失败: ' + (exec.message || exec));
        }
    }

    async download_thumbnail_as_buffer(url) {
        try {
            const response = await fetch(url, {dispatcher: this.proxy_dispatcher});

            if (!response.ok) {
                throw new Error(`下载缩图失败: ${response.status} ${response.statusText}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            return Buffer.from(arrayBuffer);
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('下载缩图时请求超时');
            }
            throw error;
        }
    }
}

