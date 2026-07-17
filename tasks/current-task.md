# Current Task

> 状态、交接、模块锁和完成门禁以 [Agent 工作流规范](../docs/architecture/AGENT-WORKFLOW.md) 为准。

## 当前任务

- Task ID：TASK-0004
- Task Name：机房服务器落位可视化系统 MVP 产品基线
- Status：READY_FOR_REVIEW
- Owner：Claude + DeepSeek Product Manager
- Reviewer：Codex Reviewer
- Branch：docs/task-0004-product-baseline
- Task File：tasks/TASK-0004-PRODUCT-BASELINE.md
- Requirement Source：hangyu 提出的企业机房服务器落位可视化需求
- Product Baseline：只定义 MVP 产品要求，不进行架构设计和代码开发
- Architecture Reference：N/A：产品基线完成后再建立架构任务
- Module Lock：TASK-0004 三条模块锁已 HANDED_OFF；交给 Codex Reviewer

## 当前目标

产出：

- docs/product/MVP-PRODUCT-BASELINE.md

该文档必须能够作为后续架构设计和开发任务的产品输入。

## 产品基线交付摘要

- 产品基线文件：docs/product/MVP-PRODUCT-BASELINE.md
- FR 数量：12
- NFR 数量：7
- AC 数量：20
- BR 数量：26
- 未决问题数量：8（详见文档第 18 章待确认事项）
- 产品假设数量：8（详见文档第 17 章产品假设）
- 用户角色：4
- 核心业务对象：6
- 页面数量：9
- 校验结果：20/20 PASS，退出码 0
- 防过度规划自检：12/12 PASS
- 提交说明：docs: define datacenter layout mvp baseline
- 交给 Codex Reviewer 独立审核

## 当前约束

- 只定义 MVP 产品基线
- 不进行架构设计
- 不编写业务代码
- 不设计数据库物理模型
- 不设计 API 契约
- 不制作高保真 UI
- 不实现 3D、实时监控或完整 CMDB
- 未来功能只进入 backlog
- 必须遵守防过度规划和防过度开发门禁
