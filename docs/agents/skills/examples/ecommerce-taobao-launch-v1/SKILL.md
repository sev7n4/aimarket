---
name: ecommerce-taobao-launch-v1
description: >
  淘宝/天猫上架全套：生成 4 张电商套图、主图白底抠图、15 秒竖屏宣传片。
  在用户提到淘宝上架、天猫主图、电商套图+短视频一键交付、商品上架素材时使用。
license: Proprietary
compatibility: Requires AIMarket image/video providers; confirm gate when estimated points exceed 80
metadata:
  aimarket.io/pipeline-file: pipeline.yaml
  aimarket.io/pipeline-version: "1"
  aimarket.io/category: ecommerce
  aimarket.io/confirm-if-points-over: "80"
  aimarket.io/skill-kind: pipeline
  aimarket.io/author: aimarket-official
---

# 淘宝上架全套 v1

## 概述

一键完成淘宝/天猫卖家常见的 **主图套图 + 白底主图 + 宣传短视频** 交付，步骤由后台流水线自动推进，用户可关闭页面等待完成。

## 何时使用

- 用户已有 **商品图**，需要上架素材包
- 明确提到：淘宝、天猫、电商套图、主图抠图、15 秒宣传片
- **不要**用于：仅单张精修、无商品的纯创意视频（改用创作台 Agent）

## 用户需准备

| 必填 | 说明 |
|------|------|
| 商品图 | 上传实物或白底图 |
| 产品描述 | 卖点、规格（用于套图文案） |

## 步骤概览

| 步骤 id | 名称 | 产出 |
|---------|------|------|
| `gen_set` | 电商套图 4 张 | 主图 / 卖点 / 场景 / 详情 |
| `cutout_hero` | 主图抠白底 | 透明 PNG |
| `promo_video` | 15 秒宣传片 | 竖屏视频 |

详细 DSL 见同目录 `pipeline.yaml`。

## 积分与确认

预估积分超过 **80** 时需用户点击确认后再执行（与 `confirmIfPointsOver` 一致）。

## 失败处理

任一步 Job 失败按现有规则退该步积分；Skill Run 标记失败，用户可在 Studio 重试失败步骤。
