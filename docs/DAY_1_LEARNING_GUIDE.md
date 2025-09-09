# Day 1: Learning Guide - Simple CRUD Operations

> **Goal**: Learn Express.js basics while implementing `GET /quiz` and `POST /quiz` endpoints  
> **Time**: 3-4 hours  
> **Outcome**: You'll write your first API endpoints!

## What You'll Learn Today

### 🎯 **Core Concepts**

- **HTTP Methods**: GET (read data) vs POST (create data)
- **Express.js Routes**: How to handle different URLs
- **TypeScript Basics**: Types, interfaces, and functions
- **Database Queries**: Reading from and writing to Supabase
- **Error Handling**: What to do when things go wrong

## Step-by-Step Learning Process

### **Step 1: Understanding the Basics (30 minutes)**

#### **What is an API Endpoint?**

Think of an API endpoint like a restaurant menu:

- **GET /quiz** = "Show me all the quizzes" (like asking for the menu)
- **POST /quiz** = "Create a new quiz" (like ordering food)

#### **HTTP Methods Explained**

```typescript
// GET = Read data (like reading a book)
app.get('/quiz', (req, res) => {
  // Send back all quizzes
});

// POST = Create data (like writing in a notebook)
app.post('/quiz', (req, res) => {
  // Create a new quiz
});
```

### **Step 2: Setting Up Your First Route (45 minutes)**

#### **Let's Start with GET /quiz**

I'll show you the complete code, then we'll break it down:

```typescript
// src/routes/quiz.ts
import express from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { logger } from '../utils/logger';

const router = express.Router();

// GET /quiz - List all quizzes for a user
router.get('/', async (req, res) => {
  try {
    // Get user ID from authentication (we'll add this later)
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'User not authenticated',
      });
    }

    // Query the database
    const { data: quizzes, error } = await supabaseAdmin
      .from('quiz_sets')
      .select('*')
      .eq('user_id', userId)
      .eq('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error) {
      logger.error({ error }, 'Error fetching quizzes');
      return res.status(500).json({
        error: 'database_error',
        message: 'Failed to fetch quizzes',
      });
    }

    // Send success response
    res.status(200).json({
      quizzes: quizzes || [],
      total: quizzes?.length || 0,
    });
  } catch (error) {
    logger.error({ error }, 'Unexpected error in GET /quiz');
    res.status(500).json({
      error: 'internal_error',
      message: 'Internal server error',
    });
  }
});

export default router;
```

#### **Let's Break This Down Together**

**1. Imports (Lines 1-3)**

```typescript
import express from 'express'; // The web framework
import { supabaseAdmin } from '../lib/supabase'; // Database connection
import { logger } from '../utils/logger'; // Logging tool
```

_What this means_: We're bringing in the tools we need to work with.

**2. Creating the Router (Line 5)**

```typescript
const router = express.Router();
```

_What this means_: We're creating a container to hold our routes.

**3. The Route Handler (Lines 7-8)**

```typescript
router.get('/', async (req, res) => {
```

_What this means_:

- `router.get` = Handle GET requests
- `'/'` = The URL path (so this handles GET /quiz)
- `async` = This function can wait for database operations
- `req` = The request (what the client sent)
- `res` = The response (what we send back)

**4. Authentication Check (Lines 9-15)**

```typescript
const userId = req.user?.id;

if (!userId) {
  return res.status(401).json({
    error: 'unauthorized',
    message: 'User not authenticated',
  });
}
```

_What this means_:

- Check if the user is logged in
- If not, send an error and stop
- `401` = Unauthorized status code
- `return` = Stop here, don't continue

**5. Database Query (Lines 17-23)**

```typescript
const { data: quizzes, error } = await supabaseAdmin
  .from('quiz_sets')
  .select('*')
  .eq('user_id', userId)
  .eq('deleted_at', null)
  .order('created_at', { ascending: false });
```

_What this means_:

- `supabaseAdmin` = Our database connection
- `.from('quiz_sets')` = Look in the quiz_sets table
- `.select('*')` = Get all columns
- `.eq('user_id', userId)` = Only get quizzes for this user
- `.eq('deleted_at', null)` = Only get non-deleted quizzes
- `.order('created_at', { ascending: false })` = Sort by newest first
- `await` = Wait for the database to respond

**6. Error Handling (Lines 25-31)**

```typescript
if (error) {
  logger.error({ error }, 'Error fetching quizzes');
  return res.status(500).json({
    error: 'database_error',
    message: 'Failed to fetch quizzes',
  });
}
```

_What this means_: If the database query failed, log the error and send a 500 error.

**7. Success Response (Lines 33-37)**

```typescript
res.status(200).json({
  quizzes: quizzes || [],
  total: quizzes?.length || 0,
});
```

_What this means_: Send back the quizzes data with a 200 success status.

### **Step 3: Your Turn - Try It! (30 minutes)**

Now let's create the POST /quiz endpoint together. I'll guide you through it:

```typescript
// POST /quiz - Create a new quiz
router.post('/', async (req, res) => {
  try {
    // TODO: Add authentication check (copy from GET route)

    // TODO: Get quiz data from request body
    const { title, description, difficulty_level, category, is_public, tags, play_settings } =
      req.body;

    // TODO: Validate required fields
    if (!title || !description || !difficulty_level || !category) {
      return res.status(400).json({
        error: 'invalid_payload',
        message: 'Missing required fields',
      });
    }

    // TODO: Insert into database
    const { data: quiz, error } = await supabaseAdmin
      .from('quiz_sets')
      .insert({
        user_id: userId, // You'll need to get this from authentication
        title,
        description,
        difficulty_level,
        category,
        is_public: is_public || false,
        tags: tags || [],
        play_settings: play_settings || {
          code: 0,
          show_question_only: true,
          show_explanation: true,
          time_bonus: false,
          streak_bonus: false,
          show_correct_answer: true,
          max_players: 400,
        },
        status: 'draft',
      })
      .select()
      .single();

    // TODO: Handle database error

    // TODO: Send success response
  } catch (error) {
    // TODO: Handle unexpected errors
  }
});
```

**Your Tasks:**

1. Fill in the TODO comments
2. Copy the authentication check from the GET route
3. Add error handling for the database insert
4. Send back the created quiz data

### **Step 4: Testing Your Code (30 minutes)**

#### **How to Test Your API**

**1. Start the server**

```bash
npm run dev
```

**2. Test GET /quiz**

```bash
curl -X GET http://localhost:8080/quiz
```

**3. Test POST /quiz**

```bash
curl -X POST http://localhost:8080/quiz \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My First Quiz",
    "description": "Learning to code!",
    "difficulty_level": "easy",
    "category": "Programming"
  }'
```

### **Step 5: Understanding What You Built (30 minutes)**

#### **What You Just Learned**

1. **HTTP Methods**: GET for reading, POST for creating
2. **Express Routes**: How to handle different URLs
3. **Database Operations**: Reading and writing to Supabase
4. **Error Handling**: What to do when things go wrong
5. **TypeScript**: Basic syntax and type safety

#### **Key Concepts to Remember**

- **Routes** = Different URLs your API can handle
- **Middleware** = Functions that run before your route handler
- **Async/Await** = How to handle database operations that take time
- **Error Handling** = Always check for errors and respond appropriately
- **Status Codes** = 200 (success), 400 (bad request), 500 (server error)

## Common Mistakes and How to Fix Them

### **Mistake 1: Forgetting await**

```typescript
// Wrong
const data = supabaseAdmin.from('quiz_sets').select('*');

// Right
const { data } = await supabaseAdmin.from('quiz_sets').select('*');
```

### **Mistake 2: Not handling errors**

```typescript
// Wrong
const { data } = await supabaseAdmin.from('quiz_sets').select('*');
res.json(data);

// Right
const { data, error } = await supabaseAdmin.from('quiz_sets').select('*');
if (error) {
  return res.status(500).json({ error: 'Database error' });
}
res.json(data);
```

### **Mistake 3: Not validating input**

```typescript
// Wrong
const { title } = req.body;
// Use title directly

// Right
const { title } = req.body;
if (!title) {
  return res.status(400).json({ error: 'Title is required' });
}
```

## Next Steps

### **What You've Accomplished**

- ✅ Created your first API endpoint
- ✅ Learned basic Express.js concepts
- ✅ Worked with a real database
- ✅ Handled errors properly

### **Tomorrow's Learning**

- PUT /quiz/:id (Update quiz)
- DELETE /quiz/:id (Delete quiz)
- More complex database operations
- Data validation with Zod

### **Questions to Ask Yourself**

1. Do I understand what each part of the code does?
2. Can I explain the flow from request to response?
3. What would happen if I changed this part?
4. What errors could occur and how are they handled?

## Remember

### **Learning is a Process**

- Don't worry if you don't understand everything immediately
- Ask questions when you're confused
- Try modifying the code to see what happens
- Celebrate small wins!

### **You're Building Real Skills**

- Every line of code you write is progress
- You're learning industry-standard practices
- These skills will help you in future projects
- You're becoming a developer!

---

**Ready to start coding? Let's build your first API endpoint together!** 🚀
