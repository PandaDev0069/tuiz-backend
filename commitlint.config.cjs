// ====================================================
// File Name   : commitlint.config.cjs
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-08-19
// Last Update : 2026-01-03
//
// Description:
// - Commitlint configuration for enforcing conventional commits
// - Integrates with Husky pre-commit hooks
// - Ensures consistent commit message format
//
// Notes:
// - Format: type(scope?): subject
// - Types: feat, fix, docs, style, refactor, test, chore
// - Used by Husky commit-msg hook
// ====================================================

//----------------------------------------------------
// 1. Configuration
//----------------------------------------------------
module.exports = { extends: ['@commitlint/config-conventional'] };
