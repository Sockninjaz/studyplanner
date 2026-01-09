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
- Full Pomodoro timer implementation (25min study, 5min break)
- Session counter and progress tracking
- Automatic break insertion for sessions >25min

### 4. Advanced Session Distribution Algorithm
-# Study Planner - Complete Project Plan

## 🎯 **CORE ALGORITHM CONCEPTS**

### **Three-Layer Pressure System**

#### **1️⃣ Session Volume Calculator (Already Working)**
```
Difficulty (1-5) + Confidence (1-5) → Total Sessions Needed
- Higher difficulty = more sessions
- Lower confidence = more sessions  
- Base range: 2-6 sessions per material
```

#### **2️⃣ Daily Capacity Pressure (How Many Slots Per Day)**
```
Adaptive formula based on time available:
- 5+ days: Gentle (1-2 sessions/day)
- 3-4 days: Moderate (2-3 sessions/day)  
- 1-2 days: Intense (2-3 sessions/day)
Creates natural buildup, not extreme spikes
```

#### **3️⃣ Session Allocation Pressure (Which Exam Gets The Slot)**
```
For each available slot:
- Time since last session (longer = higher priority)
- Remaining sessions (more = higher priority)
- Exam proximity (closer = higher priority)
Highest pressure exam gets the slot
```

## 📅 **Algorithm Flow**

### **Step 1: Calculate Total Sessions**
```
For each exam: Difficulty/Confidence → Sessions Needed
Exam A: 4 sessions, Exam B: 4 sessions, Exam C: 4 sessions
```

### **Step 2: Calculate Daily Capacity**
```
For each day: Time available → Sessions per day
Monday: 2 slots, Tuesday: 2 slots, Wednesday: 3 slots, etc.
```

### **Step 3: Allocate Sessions Daily**
```
For each day's slots:
Calculate pressure for each exam
Give slots to highest pressure exams
Update remaining sessions
```

## 🧮 **Formulas to Implement**

### **Daily Capacity Formula:**
```
if (days_available >= 5) {
    daily_capacity = 1.5 + (0.5 × progress_percentage)
} else if (days_available >= 3) {
    daily_capacity = 2.0 + (0.5 × progress_percentage)  
} else {
    daily_capacity = 2.5 + (0.5 × progress_percentage)
}
Cap at 3 sessions maximum
```

### **Allocation Pressure Formula:**
```
pressure = (days_since_last_study × 0.3) + 
          (remaining_sessions × 0.4) + 
          (exam_urgency × 0.3)
```

## 🎯 **Key Behaviors**

### **Natural Study Flow:**
- Early weeks: Calm, even distribution
- Later weeks: Gradual intensity increase  
- Final days: Focused preparation
- No extreme spikes (1→3→1→3 patterns)

### **Multi-Exam Fairness:**
- Each exam gets calculated sessions
- Earlier exams get priority early
- Later exams get focus later
- No exam gets starved completely

### **Adaptive Intensity:**
- Start early → Gentle schedule
- Start late → Intense but manageable
- Progress reduces pressure naturally

## 🛠️ **Implementation Steps**

### **Step 1: Daily Capacity Calculator**
```typescript
calculateDailyCapacity(daysAvailable: number, currentDay: number, totalDays: number): number
```

### **Step 2: Allocation Pressure Calculator**  
```typescript
calculateExamPressure(exam: Exam, lastStudied: Date, remainingSessions: number): number
```

### **Step 3: Daily Session Distributor**
```typescript
allocateDailySessions(exams: Exam[], dailyCapacity: number): SessionAllocation[]
```

### **Step 4: Full Integration**
```typescript
scheduleStudySessions() → Uses all three systems together
```

## 📊 **Test Cases**

### **Case 1: Early Start (5 days, 3 exams)**
```
Expected: 2,2,2,2,2 sessions per day
Gentle, consistent, calm
```

### **Case 2: Moderate Start (3 days, 3 exams)**
```
Expected: 2,2,3 sessions per day  
Buildup toward end
```

### **Case 3: Late Start (2 days, 3 exams)**
```
Expected: 3,3 sessions per day
Intense but focused
```

## 🚀 **Current Status**

### ✅ **Completed:**
- [x] Session volume calculator (difficulty/confidence → sessions)
- [x] Material parsing ("Chapter 1-4" → individual chapters)
- [x] Single exam scheduling (continuous study)
- [x] Natural chapter progression (1→2→3→4)

### 🔄 **In Progress:**
- [ ] Daily capacity pressure calculator
- [ ] Session allocation pressure calculator  
- [ ] Multi-exam distribution system
- [ ] Full three-layer integration

### 🎯 **Next Steps:**
1. Implement daily capacity calculator (Step 1)
2. Add allocation pressure calculator (Step 2)
3. Create daily session distributor (Step 3)
4. Integrate full system (Step 4)
5. Test with real exam scenarios

## 🛠️ **Tech Stack**

- **Frontend:** Next.js 14, React, TypeScript, TailwindCSS
- **Backend:** Next.js API routes, MongoDB with Mongoose
- **Authentication:** NextAuth.js
- **Calendar:** FullCalendar
- **State Management:** SWR for data fetching

## 📱 **Key Features**

- **Three-Layer Pressure System:** Volume + Capacity + Allocation
- **Adaptive Scheduling:** Gentle buildup based on time available
- **Multi-Exam Support:** Fair distribution across competing exams
- **Material Progression:** Natural chapter progression
- **Calendar Integration:** Visual schedule with automatic updates

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
