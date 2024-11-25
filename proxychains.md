# Proxychains 配置指南

本文档介绍如何在 Linux 环境下使用 Proxychains 进行透明代理设置，让 Yunzai-Bot 的全部插件的流量都走代理，无需另外单独配置。从而也使本插件能够在墙内正常访问 YouTube。

## 什么是 Proxychains？

Proxychains 是一个命令行工具，可以强制任何程序通过代理上网。它支持 HTTP、SOCKS4 和 SOCKS5 代理类型，是一个非常实用的透明代理工具。

## 安装步骤

### 1. 安装 Proxychains

根据你的 Linux 发行版，使用相应的包管理器安装：

**Debian/Ubuntu**:
```bash
sudo apt update
sudo apt install proxychains4
```

**CentOS/RHEL**:
```bash
sudo yum install proxychains-ng
```

**Arch Linux**:
```bash
sudo pacman -S proxychains-ng
```

### 2. 配置 Proxychains

1. 编辑配置文件：
   ```bash
   sudo nano /etc/proxychains.conf
   ```

2. 确保以下基本设置正确：
   ```conf
   # 代理链配置
   strict_chain
   proxy_dns 
   
   # 本地网络不使用代理
   localnet 127.0.0.0/255.0.0.0
   localnet 10.0.0.0/255.0.0.0
   localnet 172.16.0.0/255.240.0.0
   localnet 192.168.0.0/255.255.0.0
   ```

3. 在文件末尾添加你的代理服务器：
   ```conf
   # SOCKS5 代理
   socks5  127.0.0.1 1080
   
   # 或 HTTP 代理
   http    127.0.0.1 8080
   ```

   根据你的实际代理服务器地址和端口修改配置。

### 3. 测试配置

测试配置是否正常工作：
```bash
proxychains curl ipinfo.io
```

如果显示了代理服务器的 IP 地址，说明配置成功。

## 使用方法

### 1. 启动 Yunzai-Bot

在 Yunzai-Bot 目录下运行：
```bash
proxychains node app
```

### 2. 也可以运行其他命令

任何需要代理的命令都可以加上 `proxychains` 前缀：
```bash
proxychains git clone https://github.com/some/repo
proxychains pnpm install
```

## 常见问题

### 1. 配置文件找不到

如果提示找不到配置文件，可能是因为配置文件位置不同。常见的位置有：
- `/etc/proxychains.conf`
- `/etc/proxychains4.conf`
- `~/.proxychains/proxychains.conf`

### 2. 代理连接失败

- 检查代理服务器是否正常运行
- 确认代理服务器地址和端口是否正确
- 检查防火墙设置是否允许代理连接

### 3. DNS 解析问题

如果遇到 DNS 解析问题，可以尝试在配置文件中修改：
```conf
# 将 proxy_dns 注释掉
# proxy_dns
```

### 4. 性能问题

如果发现使用 Proxychains 后性能下降，可以：
- 使用更快的代理服务器
- 考虑使用其他代理方案（如系统级代理）

## 注意事项

1. 确保代理服务器稳定可靠
2. 定期检查代理服务器状态
3. 使用代理时注意网络安全
4. 建议使用专用的代理服务器，避免使用公共代理

## 相关资源

- [Proxychains-ng GitHub](https://github.com/rofl0r/proxychains-ng)
- [Proxychains 官方文档](https://github.com/haad/proxychains)
