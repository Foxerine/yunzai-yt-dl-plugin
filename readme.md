# yunzai-yt-dl-plugin

🚀 **yunzai-yt-dl-plugin** 是一款为 Yunzai-Bot（云崽）打造的 YouTube 视频下载插件。  
它可以自动识别消息中的 YouTube 链接，下载并发送对应的视频，并支持输出视频相关信息。

## 示例：  
![img.png](img.png)  
比较抽象的URL也可以正常识别：  
![img_1.png](img_1.png)  

---

## 📦 安装步骤

### 1. 安装插件

在你的 `Yunzai-Bot` 插件根目录下运行以下命令：

```bash
cd ./plugins
git clone https://github.com/GangFaDeShenMe/yunzai-yt-dl-plugin.git
cd yunzai-yt-dl-plugin
```

### 2. 安装依赖

```bash
pnpm install
```
或者
```bash
npm install
```
至此安装完毕。
### 3. 如果你的服务器位于墙内..
那么你可能无法正常访问 `YouTube`。你可以在墙外搭建一个 `socks` 或 `HTTP` 代理程序，并将你的机器人的所有网络流量都经过代理进行转发(透明代理)，这样就可以正常访问`YouTube`，还可以省去为每个插件都单独配置代理的麻烦。  
如果代理具有绕过大陆的配置，效果更佳。

#### 如果你使用 `Linux`，可以使用 `proxychains` 进行透明代理
`Proxychains` 是一个简单易用，允许通过代理服务器转发任何程序流量的工具，支持 HTTP、SOCKS5 等代理类型。例如：
   ```bash
   proxychains npm install
   ```
这会通过预先配置的 SOCKS5 代理转发 `npm` 的流量。  
以下以 `Arch Linux WSL` 为例演示如何配置。对于其他发行版，可以询问 ChatGPT。
0. **建立代理服务器**:  
   如果你还没有代理服务器，可以使用`xray`等工具自行搭建一个。
   > **请在合法的前提下搭建和使用。**
1. **安装 `proxychains`**:
   ```bash
   sudo pacman -S proxychains-ng
   ```

2. **编辑 `proxychains` 配置文件**：

   打开 `proxychains` 的配置文件（通常位于 `/etc/proxychains.conf`）：
   ```bash
   sudo nano /etc/proxychains.conf
   ```

3. **添加 `localnet` 规则**：

   在配置文件中找到类似如下内容的部分：

   ```text
   # Proxy DNS requests - no leak for DNS data
   proxy_dns 

   # Some IP ranges
   localnet 127.0.0.0/255.0.0.0  # loopback
   localnet 192.168.0.0/255.255.0.0  # your local subnet
   ```

   如果没有 `localnet` 规则，你可以手动添加它。该规则的作用是让 `proxychains` 绕过对本地地址（如 `127.0.0.1`）的代理请求。添加以下配置到文件中（如果已经有则确保规则是激活的）：

   ```text
   localnet 127.0.0.0/255.0.0.0
   localnet ::1/128
   ```

   这将确保任何目标地址是 `127.0.0.1` 或 `::1` 的请求都不会被 `proxychains` 代理。

4. **添加代理规则**:
   在文件中找到添加代理的位置，通常位于最后一行。然后添加:

   ```
   socks5  [你的 socks 代理服务器的IP] [端口]
   ```
   或
   ```
   http  [你的 HTTP 代理服务器的IP] [端口]
   ```
   > 某些插件的功能可能无法在HTTP透明代理下使用。
4. **保存并退出**：

   保存配置文件（`Ctrl+X`，然后 `回车` 确认）。

5. **运行 `Yunzai-Bot`**：
   切换到你的 `Yunzai-Bot` 安装目录，并运行
   ```bash
   proxychains node app
   ```

#### 如果你使用`Windows`，可以使用 `Netch`

  `Netch` 的使用比较简单，相信你不需要教程也会用。

---

## 🛠️ 使用方法


### 1. 下载 YouTube 视频

在 QQ 聊天中发送包含 YouTube 视频链接的消息，例如：

```
https://www.youtube.com/watch?v=dQw4w9WgXcQ
```

机器人将会自动解析该链接，并发送视频的基本信息及缩略图。随后，会下载并发送视频文件。

### 2. 设置超时时间

使用命令 `#ytdl超时 <秒数>` 设置视频下载的超时时间。例如：

```
#ytdl超时 600
```

此命令将超时时间设置为 600 秒。

---

## 🔍 TODO & 未来计划

- [ ] **HTTP 代理支持**：插件将添加支持代理功能，以便在网络受限的环境下下载视频。
- [ ] **自定义视频格式和分辨率**：支持更多视频格式和分辨率的选择。
- [ ] **优化多线程下载**：提升下载速度和稳定性。

---

## ⚠️ 免责声明

- 使用时请遵守各国法律，禁止用于传播任何形式的违法内容，或任何形式的商业活动。
- 使用本插件下载视频时，请遵守 YouTube 相关服务协议及版权规定。
- 本插件仅用于学习交流，插件开发者不对用户的任何非法使用行为负责。

---

## 📝 其他

如果你有任何问题、建议或改进意见，欢迎通过 GitHub Issues 进行反馈！

📧 **联系方式**：你可以通过 [GitHub Issues](https://github.com/GangFaDeShenMe/yunzai-yt-dl-plugin/issues) 提交问题和建议。


