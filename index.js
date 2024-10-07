import fs from 'fs';
import {Innertube, UniversalCache} from 'youtubei.js';
import axios from 'axios';
import ytdl from "ytdl-core";

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
            }, /*{
                reg: '#ytdl代理(.*)',
                fnc: 'set_proxy',
                permission: "master",
            }, */{
                reg: '#ytdl超时(.*)',
                fnc: 'set_timeout',
                permission: "master",
            }]
        });

        this.timeout = 300;
        // this.proxy = null; // 初始化代理为空
        // this.proxy_config_path = './plugins/yunzai-yt-dl-plugin/proxy_config.txt';
        // this.init_proxy(); // 初始化代理
    }

    // 初始化代理配置
    // init_proxy() {
    //     const proxyFilePath = this.proxy_config_path;
    //     try {
    //         if (!fs.existsSync(proxyFilePath)) {
    //             fs.writeFileSync(proxyFilePath, '');
    //             logger.info('YT视频下载: 代理配置文件不存在，已创建空文件');
    //             return;
    //         }
    //
    //         const proxyUrl = fs.readFileSync(proxyFilePath, 'utf-8').trim();
    //         if (!proxyUrl) {
    //             logger.info('YT视频下载: 配置文件为空，将使用默认配置');
    //             return;
    //         }
    //
    //         try {
    //             const url = new URL(proxyUrl);
    //             if (url.protocol === 'http:' || url.protocol === 'https:') {
    //                 this.proxy = {
    //                     host: url.hostname,
    //                     port: url.port || (url.protocol === 'http:' ? 80 : 443),
    //                     protocol: url.protocol.slice(0, -1),
    //                 };
    //                 logger.info('YT视频下载: 已从配置文件设置代理:', proxyUrl);
    //             } else {
    //                 logger.warning('YT视频下载: 配置文件中的代理 URL 协议无效，仅支持 http 或 https');
    //             }
    //         } catch (err) {
    //             logger.warning('YT视频下载: 配置文件中的代理 URL 无效:', err.message);
    //         }
    //
    //     } catch (err) {
    //         logger.error('YT视频下载: 初始化代理时出现错误:', err);
    //     }
    // }

    async set_timeout(e) {
        const regex = /#ytdl超时\s*(\d+)/i;
        const matches = e.msg.match(regex);

        if (matches && matches[1]) {
            const timeoutValue = parseInt(matches[1], 10);
            if (!isNaN(timeoutValue) && timeoutValue > 0) {
                this.timeout = timeoutValue;
                e.reply(`超时时间已设置为 ${this.timeout} 秒`);
            } else {
                e.reply('无效的超时时间，请提供有效的正整数');
            }
        } else {
            e.reply('未检测到有效的超时时间，请使用正确的格式：#ytdl超时 <秒数>');
        }
    }

    // 使用 axios 配置代理下载
    async parse_youtube(e) {
        e.reply('正在解析YouTube视频，请稍等');

        const getVideoID = (msg) => {
            const videoIDRegex = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/|user\/[^#]+\/u\/\d\/|v=))([a-zA-Z0-9_-]{11})/;
            const match = msg.match(videoIDRegex);
            if (match && match[1]) {
                return match[1];
            } else {
                throw new Error('无效的YouTube视频ID');
            }
        };

        let video_id;
        try {
            video_id = getVideoID(e.msg);
        } catch (exec) {
            e.reply('解析失败: ' + exec.message);
            return;
        }

        const yt = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true,
        });

        /*        const yt = await Innertube.create({
            fetch: async (url, options = {}) => {
                // 通过 axios 进行请求，支持代理
                try {
                    const response = await axios({
                        method: options.method || 'GET',
                        url,
                        headers: options.headers || {},
                        data: options.body || null,
                        proxy: this.proxy || false,  // 使用代理
                        timeout: this.timeout * 1000,  // 设置超时时间，单位为毫秒
                    });
                    return new Response(response.data, {
                        status: response.status,
                        statusText: response.statusText,
                    });
                } catch (error) {
                    logger.error(`请求 ${url} 失败: ${error.message}`);
                    throw error;
                }
            },
            cache: new UniversalCache(false),
            generate_session_locally: true,
        });*/

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
        try {
            img = await this.download_thumbnail_as_buffer(thumbnail_url);
            e.reply(segment.image(img));
        } catch (exec) {
            e.reply('下载缩图失败: ' + (exec.message || exec));
            return;
        }

        let ytdl_info = await ytdl.getInfo(video_id);

        const info_reply = `标题: ${video.basic_info.title}
👀: ${video.basic_info.view_count} 👍: ${video.basic_info.like_count}
发布日期: ${video.primary_info.published}
描述: ${video.basic_info.short_description}

------
作者: ${video.basic_info.author || 'Unknown'}
订阅数: ${ytdl_info.videoDetails.author.subscriber_count}`;
        e.reply(info_reply);

        try {
            const stream = await yt.download(video_id, {
                type: 'video+audio',
                quality: 'best',
                format: 'mp4',
                client: 'WEB',
            });

            const reader = stream.getReader();
            const chunks = [];
            let done, value;

            while (!done) {
                ({ done, value } = await reader.read());
                if (value) chunks.push(value);
            }

            const videoBuffer = Buffer.concat(chunks.map(chunk => Buffer.from(chunk)));
            e.reply(segment.video(videoBuffer));
        } catch (exec) {
            e.reply('下载视频失败: ' + (exec.message || exec));
        }

    }

    // 通过 axios 下载缩略图
    async download_thumbnail_as_buffer(url) {
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'arraybuffer',  // 以二进制格式下载数据
            //proxy: this.proxy || false,  // 使用代理
            timeout: this.timeout * 1000,  // 设置超时时间
        });

        return Buffer.from(response.data);
    }
}
