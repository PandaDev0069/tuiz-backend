# Quiz Creation API Implementation Plan

> **Status**: Planning Phase  
> **Created**: 2025-01-09  
> **Version**: 1.0  
> **Target**: Complete quiz creation system with full CRUD operations

## Overview

This document outlines the implementation plan for the quiz creation API system, including all necessary endpoints, data models, authentication, and integration with the existing frontend quiz creation workflow.

## Current State Analysis

### ✅ What's Already Implemented

- **Database Schema**: Complete quiz system with RLS policies
- **Frontend UI**: 4-step quiz creation workflow (Basic Info → Questions → Settings → Preview)
- **Authentication**: JWT-based auth system with Supabase
- **Database Functions**: Helper functions for quiz operations
- **Type Definitions**: Complete TypeScript interfaces in `quiz.ts`

### ❌ What's Missing

- **Backend APIs**: No quiz-related endpoints exist
- **Frontend Integration**: Quiz creation form is disconnected from backend
- **Data Persistence**: Form data only stored in local React state
- **Quiz Publishing**: No actual publishing mechanism

## Implementation Phases

### Phase 1: Core Quiz Management APIs 🎯

**Priority**: High | **Estimated Time**: 2-3 days

#### 1.1 Quiz CRUD Operations

```typescript
// Create new quiz (draft)
POST /quiz
- Body: CreateQuizSetForm
- Response: QuizSet
- Auth: Required (JWT)

// Get quiz by ID
GET /quiz/:id
- Response: QuizSetComplete
- Auth: Required (owner or public quiz)

// Update quiz
PUT /quiz/:id
- Body: UpdateQuizSetForm
- Response: QuizSet
- Auth: Required (owner only)

// Delete quiz (soft delete)
DELETE /quiz/:id
- Response: { success: boolean }
- Auth: Required (owner only)

// List user's quizzes
GET /quiz
- Query: ?status=draft&page=1&limit=10
- Response: { quizzes: QuizSet[], total: number, page: number }
- Auth: Required
```

#### 1.2 Implementation Details

- **File**: `src/routes/quiz.ts`
- **Validation**: Zod schemas for request validation
- **Database**: Direct Supabase client integration
- **Error Handling**: Consistent error contract
- **RLS**: Leverage existing Row Level Security policies

### Phase 2: Question Management APIs 📝

**Priority**: High | **Estimated Time**: 2-3 days

#### 2.1 Question Operations

```typescript
// Add question to quiz
POST /quiz/:quizId/questions
- Body: CreateQuestionForm
- Response: Question
- Auth: Required (quiz owner)

// Update question
PUT /quiz/:quizId/questions/:questionId
- Body: UpdateQuestionForm
- Response: Question
- Auth: Required (quiz owner)

// Delete question
DELETE /quiz/:quizId/questions/:questionId
- Response: { success: boolean }
- Auth: Required (quiz owner)

// Reorder questions
PUT /quiz/:quizId/questions/reorder
- Body: { questionIds: string[] }
- Response: { success: boolean }
- Auth: Required (quiz owner)
```

#### 2.2 Answer Management

```typescript
// Add answer to question
POST /quiz/:quizId/questions/:questionId/answers
- Body: CreateAnswerForm
- Response: Answer
- Auth: Required (quiz owner)

// Update answer
PUT /quiz/:quizId/questions/:questionId/answers/:answerId
- Body: Partial<CreateAnswerForm>
- Response: Answer
- Auth: Required (quiz owner)

// Delete answer
DELETE /quiz/:quizId/questions/:questionId/answers/:answerId
- Response: { success: boolean }
- Auth: Required (quiz owner)
```

### Phase 3: Quiz Publishing & Validation 🚀

**Priority**: Medium | **Estimated Time**: 1-2 days

#### 3.1 Publishing Operations

```typescript
// Publish quiz
POST /quiz/:id/publish
- Response: QuizSet
- Auth: Required (quiz owner)
- Validation: Must have questions with correct answers

// Unpublish quiz (back to draft)
POST /quiz/:id/unpublish
- Response: QuizSet
- Auth: Required (quiz owner)

// Validate quiz before publishing
GET /quiz/:id/validate
- Response: { valid: boolean, errors: string[] }
- Auth: Required (quiz owner)
```

#### 3.2 Quiz Code Management

```typescript
// Generate unique quiz code
POST /quiz/:id/generate-code
- Response: { code: number }
- Auth: Required (quiz owner)

// Set custom quiz code
PUT /quiz/:id/code
- Body: { code: number }
- Response: { code: number, success: boolean }
- Auth: Required (quiz owner)
- Validation: Code must be unique and 6 digits

// Check if quiz code is available
GET /quiz/code/check/:code
- Response: { available: boolean }
- Auth: None (public endpoint)

// Validate quiz code format
GET /quiz/code/validate/:code
- Response: { valid: boolean, message?: string }
- Auth: None (public endpoint)
```

### Phase 4: Frontend Integration 🔗

**Priority**: High | **Estimated Time**: 2-3 days

#### 4.1 API Service Layer

- **File**: `src/lib/quizService.ts`
- **Pattern**: Similar to existing `AuthService`
- **Methods**: All quiz CRUD operations
- **Error Handling**: Consistent with auth service

#### 4.2 State Management Updates

- Replace local state with API calls
- Add loading states and error handling
- Implement draft saving functionality
- Add real-time validation

#### 4.3 Form Integration

- Update `CreateQuizPage` to use API service
- Add progress indicators for API calls
- Implement proper error display
- Add success notifications

## Technical Specifications

### Database Integration

```typescript
// Use existing Supabase client
import { supabaseAdmin } from '../lib/supabase';

// Leverage existing helper functions
-generate_quiz_code() -
  update_quiz_question_count() -
  validate_quiz_for_publishing() -
  get_quiz_for_play();
```

### Authentication & Authorization

```typescript
// JWT token validation middleware
const authenticateUser = (req, res, next) => {
  // Extract token from Authorization header
  // Validate with Supabase
  // Add user_id to request object
};

// Authorization checks
- Users can only access their own quizzes
- Public published quizzes are readable by all
- Admins can access all quizzes
```

### Error Handling

```typescript
// Consistent error format
interface APIError {
  error: string;
  message: string;
  requestId?: string;
}

// Common error codes
- invalid_payload: Request validation failed
- unauthorized: Missing or invalid authentication
- forbidden: Insufficient permissions
- not_found: Resource does not exist
- validation_failed: Quiz validation failed
- server_error: Internal server error
```

### Request/Response Examples

#### Create Quiz

```typescript
// Request
POST /quiz
{
  "title": "JavaScript Basics",
  "description": "Test your JavaScript knowledge",
  "difficulty_level": "medium",
  "category": "Programming",
  "is_public": true,
  "tags": ["javascript", "programming"],
  "play_settings": {
    "show_question_only": true,
    "show_explanation": true,
    "time_bonus": true,
    "streak_bonus": false,
    "show_correct_answer": true,
    "max_players": 100
  }
}

// Response
{
  "id": "uuid-string",
  "user_id": "user-uuid",
  "title": "JavaScript Basics",
  "description": "Test your JavaScript knowledge",
  "difficulty_level": "medium",
  "category": "Programming",
  "is_public": true,
  "tags": ["javascript", "programming"],
  "status": "draft",
  "total_questions": 0,
  "times_played": 0,
  "created_at": "2025-01-09T10:30:45.123Z",
  "updated_at": "2025-01-09T10:30:45.123Z",
  "play_settings": { /* ... */ }
}
```

## File Structure

```
tuiz-backend/
├── src/
│   ├── routes/
│   │   ├── quiz.ts              # Main quiz routes
│   │   ├── questions.ts         # Question management routes
│   │   └── answers.ts           # Answer management routes
│   ├── middleware/
│   │   └── auth.ts              # JWT authentication middleware
│   ├── utils/
│   │   ├── quizValidation.ts    # Quiz validation schemas
│   │   └── quizHelpers.ts       # Quiz utility functions
│   └── types/
│       └── quiz.ts              # Backend quiz types (shared with frontend)
```

## Testing Strategy

### Unit Tests

- Individual API endpoint testing
- Validation schema testing
- Error handling testing
- Database operation testing

### Integration Tests

- End-to-end quiz creation workflow
- Authentication and authorization testing
- Database RLS policy testing
- Error contract compliance

### Test Coverage

- All API endpoints: 100%
- Error scenarios: 100%
- Authentication flows: 100%
- Database operations: 100%

## Security Considerations

### Row Level Security (RLS)

- All quiz operations respect existing RLS policies
- Users can only access their own quizzes
- Public published quizzes are readable by all authenticated users
- Admins have full access to all quizzes

### Input Validation

- All request bodies validated with Zod schemas
- SQL injection prevention through parameterized queries
- XSS prevention through proper input sanitization

### Rate Limiting

- Implement rate limiting for quiz creation endpoints
- Prevent abuse of quiz code generation
- Limit question/answer creation per quiz

## Performance Considerations

### Database Optimization

- Use existing indexes for efficient queries
- Implement pagination for quiz listing
- Cache frequently accessed quiz data
- Optimize question/answer loading with joins

### API Response Optimization

- Minimize data transfer with selective field queries
- Implement proper HTTP caching headers
- Use database functions for complex operations

## Migration Strategy

### Backend Implementation

1. Create quiz routes and middleware
2. Implement core CRUD operations
3. Add question/answer management
4. Implement publishing functionality
5. Add comprehensive testing

### Frontend Integration

1. Create quiz service layer
2. Update form components to use APIs
3. Add loading states and error handling
4. Implement draft saving
5. Add real-time validation

### Deployment

1. Deploy backend changes
2. Update frontend to use new APIs
3. Test end-to-end functionality
4. Monitor performance and errors

## Success Metrics

### Functional Requirements

- ✅ Users can create, edit, and delete quizzes
- ✅ Users can add, edit, and delete questions/answers
- ✅ Users can publish and unpublish quizzes
- ✅ Quiz validation works correctly
- ✅ All operations respect RLS policies

### Performance Requirements

- ✅ API response times < 200ms for simple operations
- ✅ API response times < 500ms for complex operations
- ✅ Support for 100+ concurrent users
- ✅ Database queries optimized with proper indexes

### Quality Requirements

- ✅ 100% test coverage for all endpoints
- ✅ Consistent error handling across all APIs
- ✅ Proper input validation and sanitization
- ✅ Security best practices implemented

## Timeline

| Phase     | Duration      | Dependencies | Deliverables               |
| --------- | ------------- | ------------ | -------------------------- |
| Phase 1   | 2-3 days      | None         | Core quiz CRUD APIs        |
| Phase 2   | 2-3 days      | Phase 1      | Question/answer management |
| Phase 3   | 1-2 days      | Phase 1      | Publishing and validation  |
| Phase 4   | 2-3 days      | Phases 1-3   | Frontend integration       |
| **Total** | **7-11 days** |              | **Complete quiz system**   |

## Risk Mitigation

### Technical Risks

- **Database Performance**: Use existing optimized schema and indexes
- **Authentication Issues**: Leverage existing proven auth system
- **Data Consistency**: Use database transactions for complex operations

### Business Risks

- **User Experience**: Maintain existing UI/UX patterns
- **Data Security**: Follow existing security practices
- **Performance**: Implement proper caching and optimization

## Next Steps

1. **Review and Approve Plan**: Get stakeholder approval
2. **Set Up Development Environment**: Ensure all tools are ready
3. **Start Phase 1**: Begin with core quiz CRUD operations
4. **Regular Progress Updates**: Daily standups and progress reports
5. **Testing and Validation**: Continuous testing throughout development

---

**Document Owner**: Development Team  
**Last Updated**: 2025-01-09  
**Next Review**: 2025-01-16
