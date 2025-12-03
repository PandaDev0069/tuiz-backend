# Prompt

## Overview

This is prompt describing the backend work that needs to be done for the project.

The prompt is following:

- We need to initialize database tables for games when a new game is created and other related games tables when a new game is created.
- Currently, Backend for games table is completed but the related tables are not created when a new game is created.
- We need to implement the logic to create these related tables when a new game is created.
- Tables are following with schema:

1. games

   ```sql
   create table public.games (
   id uuid not null default gen_random_uuid (),
   quiz_set_id uuid not null,
   game_code character varying(10) not null,
   current_players integer null default 0,
   status public.game_status null default 'waiting'::game_status,
   current_question_index integer null default 0,
   current_question_start_time timestamp with time zone null,
   game_settings jsonb null default '{}'::jsonb,
   locked boolean null default false,
   created_at timestamp with time zone null default now(),
   updated_at timestamp with time zone null default now(),
   started_at timestamp with time zone null,
   paused_at timestamp with time zone null,
   resumed_at timestamp with time zone null,
   ended_at timestamp with time zone null,
   user_id uuid null,
   constraint games_pkey primary key (id),
   constraint games_user_id_fkey foreign KEY (user_id) references auth.users (id) on delete set null
   ) TABLESPACE pg_default;

   create unique INDEX IF not exists uq_games_game_code on public.games using btree (game_code) TABLESPACE pg_default;

   create index IF not exists idx_games_quiz_set_id on public.games using btree (quiz_set_id) TABLESPACE pg_default;

   create index IF not exists idx_games_status on public.games using btree (status) TABLESPACE pg_default;

   create index IF not exists idx_games_user_id on public.games using btree (user_id) TABLESPACE pg_default;

   create trigger update_games_updated_at BEFORE
   update on games for EACH row
   execute FUNCTION update_updated_at_column ();

   ```

2. game_flows

   ```sql
   create table public.game_flows (
   id uuid not null default gen_random_uuid (),
   game_id uuid not null,
   quiz_set_id uuid not null,
   total_questions integer not null default 0,
   current_question_id uuid null,
   next_question_id uuid null,
   current_question_index integer null default 0,
   current_question_start_time timestamp with time zone null,
   current_question_end_time timestamp with time zone null,
   created_at timestamp with time zone not null default now(),
   updated_at timestamp with time zone not null default now(),
   constraint game_flows_pkey primary key (id),
   constraint fk_game_flows_games foreign KEY (game_id) references games (id) on delete CASCADE
   ) TABLESPACE pg_default;

   create index IF not exists idx_game_flows_game_id on public.game_flows using btree (game_id) TABLESPACE pg_default;

   create index IF not exists idx_game_flows_quiz_set_id on public.game_flows using btree (quiz_set_id) TABLESPACE pg_default;

   create trigger update_game_flows_updated_at BEFORE
   update on game_flows for EACH row
   execute FUNCTION update_updated_at_column ();
   ```

- There are other tables related to games and payers but in this session we are going to focus on game_flows table only.

This table is essential for managing the flow of the game, including tracking the current question, next question, and timing details. This is the heart of the game's progression logic.

- Please implement the logic to create this table when a new game is created in the system.
- Make sure to handle any potential errors and edge cases, such as ensuring that the game_id and quiz_set_id are valid and exist in their respective tables before creating the game_flows entry.
- After implementing the logic, please test it thoroughly to ensure that the game_flows table is created correctly and that all fields are populated as expected when a new game is created.
- Finally, document the changes made to the codebase, including any new functions or methods created to handle the creation of the game_flows table.

## Requirements

- Create separate file for game_flows table creation logic.
- Implement logic to create the game_flows table when a new game is created.
- Ensure proper error handling and validation for game_id and quiz_set_id.
- Test the implementation thoroughly.
- Document the changes made to the codebase.

## Extra context

- Check out migration files for reference on how to create tables and triggers.
- Refer to existing code that handles game creation for integration points.
- Game creation logic in frontend is not implemented yet, focus only on backend logic for now.
