---
name: cathat-dispatch
description: Dispatch or continue BB child threads under the CatHat controller.
---

# CatHat Dispatch

先用 `bb thread list` 确认同目标是否已有子线程，并核对当前活跃数量。已有线程用 `tell`，新目标用 `spawn`。项目、环境和权限按实际工作范围选择。

```sh
bb thread spawn --parent-self --project "<project-id>" --environment "<environment-id>" \
  --provider "<provider-id>" --model "<model-id>" --parent-notifications stuck \
  --title "<task title>" --prompt-file task.md

bb thread tell "<thread-id>" --message-file task.md
```

只有主控明确要在成功时接力才选 `auto`，并写出接力动作。遇到运行阻塞、执行权限不足或目标变更，子线程带证据汇报。

```markdown
【子任务】
目标与完成条件：
背景与已有证据：
授权范围、工作目录和交付物：
验证方式：
完工后：用户审阅 / 主控接力（写明动作） / 无
```

| Task | Selection guidance | Your configured provider / model |
| --- | --- | --- |
| 快速只读或汇总 | 低延迟、可靠引用事实 | Claude / Codex / Gemini：填写 |
| 常规实现 | 能执行工具并跟进测试 | Claude / Codex / Gemini：填写 |
| 底层排查或 Code Review | 高严谨推理，能独立复核原件 | Claude / Codex / Gemini：填写 |
| 长文撰写 | 长上下文和稳定表达 | Claude / Codex / Gemini：填写 |
