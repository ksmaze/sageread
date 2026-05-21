import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { LEARNING_NOTE_QUICK_ACTION_PROMPT } from "./learning-note-prompts";
import { CREATE_NOTE_TOOL_DESCRIPTION } from "./tools/create-note";
import { RESOLVE_NOTE_SOURCE_TOOL_DESCRIPTION } from "./tools/resolve-note-source";

interface DefaultSkill {
  name: string;
  content: string;
  is_system: boolean;
  is_active: boolean;
}

function getDefaultLearningNoteSkill(): DefaultSkill {
  const defaultSkillsPath = new URL("../../src-tauri/src/core/default-skills.json", import.meta.url);
  const skills = JSON.parse(readFileSync(defaultSkillsPath, "utf8")) as DefaultSkill[];
  const skill = skills.find((item) => item.name === "生成学习笔记");

  assert.ok(skill, "default learning-note skill should exist");
  return skill;
}

describe("AI learning note prompt contract", () => {
  it("uses a quick action prompt for multi-note automatic saving", () => {
    assert.match(LEARNING_NOTE_QUICK_ACTION_PROMPT, /生成学习笔记/);
    assert.match(LEARNING_NOTE_QUICK_ACTION_PROMPT, /最多\s*3\s*条/);
    assert.match(LEARNING_NOTE_QUICK_ACTION_PROMPT, /自动保存/);
    assert.doesNotMatch(LEARNING_NOTE_QUICK_ACTION_PROMPT, /一条学习笔记/);
  });

  it("declares both quick-action and targeted annotation modes in the default skill", () => {
    const content = getDefaultLearningNoteSkill().content;

    assert.match(content, /快速生成模式/);
    assert.match(content, /定向批注模式/);
    assert.match(content, /最多\s*3\s*条/);
    assert.match(content, /真实原文/);
    assert.match(content, /引用\/选中文本/);
    assert.match(content, /逐条调用 resolveNoteSource/);
    assert.match(content, /逐条调用 createNote/);
    assert.match(content, /章首 fallback/);
    assert.doesNotMatch(content, /确定 1 个最重要的知识点/);
    assert.doesNotMatch(content, /生成一条学习笔记/);
  });

  it("keeps tool descriptions aligned with passage-level note creation", () => {
    assert.match(RESOLVE_NOTE_SOURCE_TOOL_DESCRIPTION, /同一个目标/);
    assert.match(RESOLVE_NOTE_SOURCE_TOOL_DESCRIPTION, /引用\/选中文本/);
    assert.match(RESOLVE_NOTE_SOURCE_TOOL_DESCRIPTION, /不要把多个无关段落/);

    assert.match(CREATE_NOTE_TOOL_DESCRIPTION, /每次只保存一条/);
    assert.match(CREATE_NOTE_TOOL_DESCRIPTION, /不要在 content 中重复原文/);
    assert.match(CREATE_NOTE_TOOL_DESCRIPTION, /章首 fallback/);
  });
});
