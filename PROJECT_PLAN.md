# AI-Assisted Study Planner - Project Plan

## Project Overview
Build a web-based study planner that helps students create, track, and execute personalized study sessions during exam periods.

## Core Features

### 1. Study Material Input
- Subject/Chapter/Book entry system
- Difficulty rating (1-5 scale)
- Confidence level assessment (1-5 scale)
- Available time specification
- Exam date tracking

### 2. Intelligent Planning Engine
- Weighted scoring algorithm for session allocation
- Time distribution based on difficulty and confidence gaps
- Automatic break scheduling (Pomodoro technique)
- Calendar conflict resolution

### 3. Session Execution
- Start Learning button with countdown timer
- Automatic break insertion for sessions >25min
- Real-time progress tracking
- Checkbox system for study items
- Notes and self-evaluation (1-5 stars)
- Session completion validation

### 4. Calendar & Visualization
- Monthly/weekly calendar view
- Study session mapping
- Exam date highlighting
- Progress bars for exam preparation
- List view sidebar
- Interactive session details

### 5. Exam Management
- Create and manage exams
- Link study sessions to exams
- Progress tracking per exam
- Test pane with all related sessions

## Technical Architecture

### Frontend Stack
- **Next.js 14** - React Framework
- **TypeScript** - Type safety
- **TailwindCSS** - Styling
- **FullCalendar** - Calendar component
- **React Hook Form** - Form management
- **Zustand** - State management
- **React Query / SWR** - Data fetching

### Backend Stack
- **Next.js API Routes** - API server
- **MongoDB** - Database
- **Mongoose** - ODM
- **NextAuth.js** - Authentication
- **bcrypt** - Password hashing

### Database Schema

#### Users Collection
```javascript
{
  _id: ObjectId,
  email: String,
  password: String,
  name: String,
  createdAt: Date,
  preferences: {
    defaultSessionLength: Number,
    breakLength: Number,
    reminderSettings: Object
  }
}
```

#### Exams Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  title: String,
  subject: String,
  date: Date,
  description: String,
  studyMaterials: [{
    chapter: String,
    book: String,
    difficulty: Number, // 1-5
    confidence: Number, // 1-5
    estimatedHours: Number,
    completed: Boolean
  }],
  createdAt: Date,
  updatedAt: Date
}
```

#### StudySessions Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  examId: ObjectId,
  title: String,
  scheduledDate: Date,
  duration: Number, // minutes
  studyItems: [{
    material: String,
    completed: Boolean,
    notes: String,
    selfRating: Number, // 1-5
    timeSpent: Number
  }],
  actualStartTime: Date,
  actualEndTime: Date,
  status: String, // scheduled, in_progress, completed, missed
  breaks: [{
    startTime: Date,
    endTime: Date,
    duration: Number
  }]
}
```

### Planning Algorithm

#### Session Allocation Formula
```javascript
function calculateSessionTime(material) {
  const difficultyWeight = material.difficulty * 0.6;
  const confidenceGap = (5 - material.confidence) * 0.4;
  const complexityMultiplier = 1 + (difficultyWeight + confidenceGap) / 10;
  
  return material.estimatedHours * 60 * complexityMultiplier; // minutes
}
```

#### Time Distribution Logic
```javascript
function distributeStudySessions(exam, availableTimeSlots) {
  const materials = exam.studyMaterials;
  const totalRequiredTime = materials.reduce((sum, material) => 
    sum + calculateSessionTime(material), 0);
  
  // Sort by priority (high difficulty + low confidence)
  const prioritizedMaterials = materials.sort((a, b) => {
    const scoreA = a.difficulty + (5 - a.confidence);
    const scoreB = b.difficulty + (5 - b.confidence);
    return scoreB - scoreA;
  });
  
  // Allocate sessions based on available slots and priorities
  return createSessionSchedule(prioritizedMaterials, availableTimeSlots);
}
```

## Development Phases

### Phase 1: Core Infrastructure (Week 1-2)
- [ ] Set up Next.js project with TypeScript & TailwindCSS
- [ ] Configure basic UI components and layout
- [ ] Set up NextAuth.js for user authentication
- [ ] Connect to MongoDB Atlas

### Phase 2: Data Management (Week 3)
- [ ] Implement exam creation and management
- [ ] Build study material input forms
- [ ] Create database schemas and API endpoints
- [ ] Add data validation and error handling

### Phase 3: Planning Engine (Week 4)
- [ ] Implement session planning algorithm in an API route
- [ ] Build calendar integration with FullCalendar
- [ ] Add time conflict detection
- [ ] Create session scheduling interface

### Phase 4: Session Execution (Week 5)
- [ ] Build timer component with break management
- [ ] Implement session tracking and progress
- [ ] Add notes and self-evaluation features
- [ ] Create session completion workflow

### Phase 5: Visualization & UI Polish (Week 6)
- [ ] Implement calendar and list views
- [ ] Add progress bars and statistics
- [ ] Build exam detail panes
- [ ] Responsive design optimization

### Phase 6: Advanced Features (Week 7-8)
- [ ] Add reminder notifications (e.g., email)
- [ ] Implement data export/import
- [ ] Add study analytics dashboard
- [ ] Performance optimization

## File Structure
```
studyplanner/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/
│   │   │   ├── calendar/
│   │   │   ├── exams/
│   │   │   └── session/
│   │   ├── api/
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/ (for shadcn components)
│   │   ├── shared/
│   │   └── icons/
│   ├── lib/
│   │   ├── db/
│   │   ├── auth.ts
│   │   └── utils.ts
│   └── types/
├── public/
└── tailwind.config.ts
```

## Deployment Strategy
1. **Frontend & Backend**: Deploy to Vercel (free tier)
2. **Database**: MongoDB Atlas free tier
3. **Domain**: Configure custom domain if needed

## Cost Analysis
- **Hosting**: $0 (Vercel free tier)
- **Database**: $0 (MongoDB Atlas free tier)
- **Authentication**: $0 (NextAuth.js)
- **Total**: $0 for core features

## Success Metrics
- User engagement rate
- Session completion rate
- Study plan adherence
- User satisfaction scores
- Performance metrics (load time < 2s)

## Future Enhancements
- Mobile app development
- AI-powered study recommendations
- Collaborative study groups
- Integration with calendar apps
- Advanced analytics dashboard
