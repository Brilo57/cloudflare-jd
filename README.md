# Cloudflare JD Demo

这是一个最小可跑通的 Cloudflare 版本：

- `public/`：静态前端单页
- `functions/api/jd.js`：唯一的 Pages Function 接口
- `wrangler.toml`：本地开发和部署配置

## 需要配置的环境变量

在 Cloudflare Pages 项目里添加：

- `APPKEY`
- `UNION_ID`
- `POSITION_ID`

其中 `POSITION_ID` 可选，默认值已经在 `wrangler.toml` 里写成了 `111`。

## 本地开发

如果本机已经安装 `wrangler`：

```bash
cd cloudflare-jd
wrangler pages dev public
```

## 部署思路

1. 在 Cloudflare 创建一个 Pages 项目。
2. 把 `cloudflare-jd` 目录作为项目根目录。
3. 构建命令留空。
4. 输出目录填写 `public`。
5. 在 Pages 设置里配置环境变量。
6. 部署后访问首页，提交京东链接测试。

## 域名

如果你的域名已经托管在 Cloudflare，可以直接把自定义域名绑定到这个 Pages 项目。

