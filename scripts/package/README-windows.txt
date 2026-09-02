机房管理系统 v2.0.5 — Windows 便携版
================================

## 使用步骤

1. 解压整个文件夹到任意路径（建议不要放在 Program Files 下）。
2. 双击 **Start-Datacenter.bat** 启动（不要直接双击 Datacenter.Api.exe）。
3. 等待黑色窗口提示“服务已启动”，浏览器会自动打开 http://127.0.0.1:5142/
4. 首次登录：
   - 用户名：admin
   - 密码：admin123
5. 关闭黑色命令行窗口即可停止服务。

## 无法登录？

1. 确认通过 **Start-Datacenter.bat** 启动（不要直接双击 Datacenter.Api.exe）。
2. 运行 **Reset-Datacenter-Data.bat**，输入 `YES` 清空本地数据库后重新启动。
3. 或手动删除这两个位置后重启：
   - `%LocalAppData%\Datacenter`
   - 解压目录中的 `datacenter.db`、`datacenter.db-wal`、`datacenter.db-shm`
4. 建议使用最新版 v2.0.5 便携包。

## 导入自己的数据

### 方式 A — 一站式导入（推荐，v2.0.5）

若你有「设备连接信息」整理合并格式的 Excel（每行一条线缆）：

1. 首页 → **导入设备连接信息**
2. 上传文件 → 预览 → 确认导入
3. 系统自动创建机房、机柜、设备与线缆

格式见 `import-templates/导入文件格式说明.md` 第 5 节。

### 方式 B — 分步模板导入

解压目录下的 `import-templates` 文件夹内有 Excel 模板：

1. 先在首页手动新建机房。
2. 按 `import-templates/导入说明.txt` 的顺序修改模板并导入：
   - 机柜 → 服务器 → （可选）设备 U 位标签 → （可选）线缆
3. 详细列格式见 `import-templates/导入文件格式说明.md`。

## 说明

- 无需安装 Node.js、.NET 或 WSL；运行时已随包提供。
- 数据保存在：`%LocalAppData%\Datacenter\datacenter.db`
- 仅在本机 127.0.0.1 提供服务，局域网其他设备无法访问。
- 这是便携版，不是安装程序；卸载时删除解压目录即可，数据默认保留在上述数据目录。

## 系统要求

- Windows 10 x64 或更高版本
- 已安装任意现代浏览器（Edge / Chrome 等）
