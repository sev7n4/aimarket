# 引用文件命名规范

> 本文档定义 references 和 scripts 目录下文件的命名规范。

---

## 命名格式

```
{step}_{level}_{name}.{ext}
```

| 字段 | 说明 | 示例 |
|------|------|------|
| step | 引用该文件的步骤编号 | 00, 01, 05, 10 |
| level | 引用链层级（从1开始） | 01, 02, 03 |
| name | 文件功能名称 | issue_parsing, test_lifecycle |
| ext | 文件扩展名 | md, json |

---

## 层级定义

| 层级 | 说明 | 示例 |
|------|------|------|
| 01 | SKILL.md 直接引用 | 01_01_issue_parsing.md |
| 02 | 一级引用文档的引用 | 05_02_test_case_templates.md |
| 03 | 二级引用文档的引用 | 05_03_xxx.md |

---

## references 目录

| 原文件名 | 新文件名 | 引用步骤 | 层级 |
|----------|----------|----------|------|
| state_fields.md | 00_01_state_fields.md | Step 0, 5-7 | 01 |
| issue_parsing.md | 01_01_issue_parsing.md | Step 1 | 01 |
| branch_naming.md | 03_01_branch_naming.md | Step 2-3 | 01 |
| code_analysis.md | 04_01_code_analysis.md | Step 4 | 01 |
| test_lifecycle.md | 05_01_test_lifecycle.md | Step 5-7 | 01 |
| test_case_templates.md | 05_02_test_case_templates.md | Step 5-7 | 02 |
| pr_template.md | 09_01_pr_template.md | Step 9 | 01 |
| monitor_scripts.md | 10_01_monitor_scripts.md | Step 10 | 01 |
| error_reference.md | 11_01_error_reference.md | Step 11 | 01 |
| deploy_guide.md | 13_01_deploy_guide.md | Step 13 | 01 |

---

## scripts 目录

| 原文件名 | 新文件名 | 引用步骤 | 层级 |
|----------|----------|----------|------|
| workflow_state.json | 00_01_workflow_state.json | Step 0-14 | 01 |
| test_cases_state.json | 05_01_test_cases_state.json | Step 5-7 | 01 |

**说明**：
- `00_01_workflow_state.json`: Step 0 初始化，被所有步骤引用
- `05_01_test_cases_state.json`: Step 5-7 TDD 流程专用

---

## 命名优势

1. **快速定位**: 通过文件名即可知道引用步骤
2. **层级清晰**: 通过层级编号理解引用关系
3. **排序友好**: 文件按步骤顺序排列
4. **统一规范**: references 和 scripts 目录遵循相同命名规则
