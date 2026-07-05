/** 与前端 studio-draft-session、jobs 自动标题逻辑保持一致 */
export const AUTO_SESSION_TITLES = new Set(["未命名", "新建画布", "新建项目"]);

export const EMPTY_CANVAS_LAYOUT_JSON = '{"version":1,"items":[]}';

/**
 * 列表侧过滤：默认标题 + 无消息/资产/任务/布局 的空闲会话不展示。
 * 有 source_inspiration_id 的会话保留（做同款流程可能尚未生成）。
 */
export const HIDE_EMPTY_AUTO_TITLED_SESSIONS_SQL = `
  AND NOT (
    s.title IN ('未命名', '新建画布', '新建项目')
    AND s.status = 'idle'
    AND (s.source_inspiration_id IS NULL OR s.source_inspiration_id = '')
    AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.session_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM assets a WHERE a.session_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM generation_jobs j WHERE j.session_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM agent_runs ar WHERE ar.session_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM skill_runs sr WHERE sr.session_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM drama_plan_runs dpr WHERE dpr.session_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM drama_runs dr WHERE dr.session_id = s.id)
    AND NOT EXISTS (SELECT 1 FROM drama_projects dp WHERE dp.session_id = s.id)
    AND (
      s.canvas_layout IS NULL
      OR trim(s.canvas_layout) = ''
      OR s.canvas_layout = '{"version":1,"items":[]}'
    )
  )
`;
