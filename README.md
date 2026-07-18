# 团队空间管理

一个给个人或小团队使用的本地管理工具，用来记录订阅空间、母账号和出租子账号，并集中查看到期风险、空间成本和应收收入。

适合直接在自己的电脑上运行。数据保存在本地 SQLite 文件中，不需要额外安装数据库服务。

## 能做什么

- 记录空间订阅成本、到期日、支付渠道和币种。
- 在一个空间下管理母账号与子账号，区分自用和出租账号。
- 在仪表盘查看续费风险、空间支出、出租账号应收和支出分布。
- 设置到期提醒的时间、收件邮箱、SMTP 和邮件模板。
- 维护支付渠道、币种与汇率等参考数据。

## 本地启动

下面的步骤适合从 GitHub 拉取项目后直接在自己的电脑上运行，Windows、macOS 和 Linux 均可使用。

### 1. 安装准备工具

先安装下面两个工具：

- [Git](https://git-scm.com/downloads)，用于从 GitHub 下载和更新项目。
- [Node.js 24.18.x](https://nodejs.org/)，用于运行应用。安装完成后重新打开终端。

### 2. 从 GitHub 拉取项目

打开终端，进入准备存放项目的目录，然后执行：

```shell
git clone https://github.com/Userchenentao5/team-account-manager.git
cd team-account-manager
npm install
```

### 3. 准备登录密钥

应用只供一个人使用，需要先设置一把登录密钥。请记住这把密钥，稍后登录时会用到它。

先生成用于保护登录会话的随机值：

```shell
node -e "console.log(crypto.randomUUID() + crypto.randomUUID())"
```

复制输出结果，稍后填入 `APP_AUTH_SECRET`。

然后把下面命令中的 `请改成你自己的登录密钥` 改成你的密钥后执行：

```shell
node -e "const crypto = require('node:crypto'); console.log(crypto.createHash('sha256').update(process.argv[1]).digest('hex'))" "请改成你自己的登录密钥"
```

复制输出结果，稍后填入 `APP_LOGIN_KEY_HASH`。不要把原始登录密钥填入这个字段。

创建配置文件后，用自己习惯的文本编辑器打开它。

Windows PowerShell：

```powershell
Copy-Item .env.example .env.local
notepad .env.local
```

macOS 或 Linux：

```shell
cp .env.example .env.local
nano .env.local
```

将文件内容改成下面这样：

```dotenv
APP_AUTH_SECRET=粘贴第一段命令生成的内容
APP_LOGIN_KEY_HASH=粘贴第二段命令生成的内容
APP_MFA_ISSUER=Team Account Manager
APP_MFA_ACCOUNT_NAME=admin
```

后两项用于 Authenticator App 中显示的服务名和账号名，可按需修改。

保存并关闭文本编辑器。

### 4. 初始化并启动

```shell
npm run db:migrate
npm run db:seed
npm run dev
```

看到终端出现 `Ready` 后，在浏览器打开：

```text
http://localhost:3000
```

使用你在上一步设置的原始登录密钥登录。

### 5. 停止或再次启动

```text
停止：在正在运行 npm run dev 的终端按 Ctrl+C

以后再次启动：进入项目目录后执行 npm run dev
```

## 第一次使用

建议按下面顺序录入信息，仪表盘的数据会更完整。

1. 打开左侧的“参考数据”。默认币种已由初始化命令写入；新增需要的支付渠道。
2. 打开“汇率”，等待首次自动刷新完成，或点击“刷新汇率”。此步骤需要服务器能够访问 Frankfurter 汇率服务。
3. 打开“空间”，新增每一项订阅空间，填写成本、到期日和支付渠道。
4. 进入空间详情，添加母账号和子账号。出租账号会计入应收，自用账号只计数量。
5. 打开“设置”，按需要绑定 Authenticator、调整到期天数、提醒邮箱和邮件发送配置。MFA 只有在首次动态安全码验证通过后才会启用。
6. 回到“仪表盘”，优先处理续费工作台列出的空间与出租账号。

## 日常使用说明

### 仪表盘

仪表盘把最需要处理的事情放在前面：

- “续费风险”显示已过期、今日到期和近期到期的空间或出租账号。
- “本期现金流”将空间订阅视为成本，将出租子账号视为应收收入。
- “运营规模”统计空间、出租账号、自用账号和席位类型。
- “支出分布”帮助判断成本主要集中在哪些空间和支付渠道。

### 空间与账号

每个空间代表一项订阅服务或团队资源。进入空间后可以维护：

- 母账号信息和席位类型。
- 子账号的联系人、收费金额、账期和下次收款日。
- 该空间的成本、到期信息和支付渠道。

删除空间会同时删除其下的账号记录。删除前请确认不再需要这些数据。

### 到期提醒

在“设置”中可以开启空间提醒和子账号提醒。每类提醒都可以设置：

- 是否启用。
- 收件邮箱和发送时间。
- SMTP 地址与发件邮箱。
- 邮件模板，并可发送测试邮件。

未配置 SMTP 时，应用仍可正常管理数据，只是不会实际发送邮件。

## 线上手动部署

线上使用推荐一台单独的 Linux 服务器，运行一个应用实例。项目使用本地 SQLite 数据库，因此不要同时启动多个实例，也不需要配置 CI/CD 自动发布。

### 首次部署

先通过 SSH 登录服务器，安装 Git 和 Node.js `24.18.x`。然后手动执行：

```bash
git clone https://github.com/Userchenentao5/team-account-manager.git
cd team-account-manager
npm install
cp .env.example .env.production
nano .env.production
```

在 `.env.production` 中填写本地启动时生成的两个登录值，并额外加入下面一行，让纯 HTTP 访问可以正常保持登录状态：

```dotenv
APP_AUTH_SECRET=你的会话密钥
APP_LOGIN_KEY_HASH=你的登录密钥哈希
APP_ALLOW_INSECURE_COOKIES=true
```

保存后继续执行：

```bash
npm run db:migrate
npm run db:seed
npm run build
npm run start
```

然后在浏览器访问：

```text
http://服务器公网 IP:3000
```

服务器的安全组和系统防火墙需要允许 TCP `3000` 端口。使用纯 HTTP 时，登录密钥和业务数据不会加密传输，请仅在你信任的网络中使用，并且不要公开 `.env.production` 或 `data` 文件夹。

### 保持应用运行

`npm run start` 运行在当前终端。若关闭 SSH 连接，应用也会停止。线上长期使用时，请在服务器上用已有的进程管理工具或面板，将下面命令配置为常驻启动命令：

```bash
npm run start
```

### 手动更新线上应用

每次更新都在服务器项目目录中手动执行。更新前先备份 `data` 文件夹，然后停止正在运行的应用，执行：

```bash
git pull
npm install
npm run db:migrate
npm run db:seed
npm run build
npm run start
```

没有使用 CI/CD。是否更新、何时更新以及何时重启服务，都由你手动决定。

## 数据与备份

所有数据都保存在项目目录的 `data` 文件夹中，主要文件是 `data/app.db`。

备份时先在运行窗口按 `Ctrl+C` 停止应用，再复制整个 `data` 文件夹到安全位置。恢复时，将备份的 `data` 文件夹放回项目目录，然后执行：

```shell
npm run db:migrate
npm run db:seed
npm run dev
```

请妥善保管 `.env.local` 和 `data` 文件夹。前者包含登录配置，后者包含业务数据。

## 更新应用

在项目目录执行：

```shell
git pull
npm install
npm run db:migrate
```

更新前建议先备份 `data` 文件夹。完成后使用 `npm run dev` 再次启动应用。

## 常见问题

### 无法打开 `http://localhost:3000`

确认终端中仍在运行 `npm run dev`。若启动失败，可在项目目录执行：

```shell
npm run dev
```

如果提示 `3000` 端口已被占用，改用：

```shell
npm run dev -- -p 3001
```

然后访问 `http://localhost:3001`。

### 登录失败

确认输入的是原始登录密钥，而不是 SHA-256 哈希值。若已启用 MFA，还需输入 Authenticator App 当前显示的 6 位动态安全码。连续输错 5 次后，当前网络地址会被锁定 15 分钟。

### Authenticator 设备丢失

先停止应用并备份 `data` 文件夹，再由服务器管理员执行下面的本地命令重置 MFA；之后可仅凭原始登录密钥登录并重新绑定。

```shell
node -e "const Database=require('better-sqlite3');const db=new Database('./data/app.db');db.prepare(\"DELETE FROM app_setting WHERE key LIKE 'auth.mfa.%'\").run();db.close();console.log('MFA reset');"
```

### 为什么没有币种、汇率或 CNY 换算值

先执行一次 `npm run db:seed` 写入默认币种，再打开“参考数据 -> 汇率”并点击“刷新汇率”。若刷新仍失败，请检查网络是否能访问 Frankfurter 汇率服务。

### 可以直接暴露到公网吗

不建议直接暴露。该应用面向单个受信任用户，请使用 HTTPS、访问控制或 VPN 后再提供远程访问，并且不要公开 `.env.local` 或数据库文件。

## 维护与检查

下面命令通常只在修改项目代码时需要：

```shell
npm run lint
npm test
npm run build
```
