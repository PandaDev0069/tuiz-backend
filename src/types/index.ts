// ====================================================
// File Name   : index.ts
// Project     : TUIZ
// Author      : PandaDev0069 / Panta Aashish
// Created     : 2025-11-19
// Last Update : 2025-11-19

// Description:
// - Central export file for all type definitions
// - Re-exports auth, quiz, game, and supabase types
// - Provides unified type imports across the application

// Notes:
// - Import any type using: import { TypeName } from '@/types'
// - Barrel export pattern for clean imports
// ====================================================

//----------------------------------------------------
// 1. Type Exports
//----------------------------------------------------
export * from './auth';
export * from './quiz';
export * from './quiz-library';
export * from './game';
export * from './supabase';
