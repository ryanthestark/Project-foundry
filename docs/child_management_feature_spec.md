# Child Management Feature - Functional Specification

**Document Version:** 1.1  
**Date:** 2025-08-04  
**Author:** Researcher Aider  
**Project:** Family OS - Pilot V1  
**Status:** Implementation Ready  

## 1. Executive Summary

The Child Management feature is a foundational component of the Family OS that enables parents to create, manage, and monitor their children's digital profiles within a secure family ecosystem. This feature serves as the cornerstone for all family management capabilities including chores, rewards, activity tracking, and behavioral monitoring.

### 1.1 Key Capabilities
- Secure child profile creation and management with family-based access control
- Comprehensive child dashboard with points, activities, and progress tracking
- Avatar management with image upload and optimization
- Age-appropriate privacy protections and COPPA compliance
- Integration with existing chores and rewards systems
- Audit trail for all child data modifications

### 1.2 Implementation Priority
This specification is marked as **Implementation Ready** and addresses all key architectural questions including user journeys, data models, permissions, and technical requirements.

## 2. Feature Overview

### 2.1 Purpose
Enable parents to comprehensively manage their children's digital profiles, track their development, and coordinate family activities through a centralized management system.

### 2.2 Scope
- Child profile creation and management
- Avatar and personal information management
- Points/rewards balance tracking
- Activity and progress monitoring
- Family hierarchy management
- Child-specific settings and permissions

## 3. User Stories

### 3.1 Primary User Stories

**US-001: Create Child Profile**
- **As a** parent
- **I want to** create a new child profile
- **So that** I can track my child's activities and manage their participation in family systems

**US-002: Edit Child Information**
- **As a** parent
- **I want to** edit my child's profile information
- **So that** I can keep their details current and accurate

**US-003: Manage Child Avatar**
- **As a** parent
- **I want to** upload and manage my child's avatar
- **So that** the child feels personalized engagement with the system

**US-004: View Child Dashboard**
- **As a** parent
- **I want to** view a comprehensive dashboard for each child
- **So that** I can monitor their progress, points, and activities

**US-005: Archive/Remove Child**
- **As a** parent
- **I want to** archive or remove a child's profile
- **So that** I can manage family changes appropriately

### 3.2 Secondary User Stories

**US-006: Bulk Child Operations**
- **As a** parent with multiple children
- **I want to** perform bulk operations across children
- **So that** I can efficiently manage family-wide activities

**US-007: Child Permission Management**
- **As a** parent
- **I want to** set age-appropriate permissions for each child
- **So that** I can control their access to different features

## 4. User Journey Specifications

### 4.1 Add New Child Journey

**Step-by-Step Process:**

1. **Navigation to Child Management**
   - Parent logs into Family OS dashboard
   - Clicks "Child Management" in main navigation or sidebar
   - Arrives at Child Management dashboard showing existing children (if any)

2. **Initiate Child Creation**
   - Parent clicks "Add Child" button (prominent CTA in header)
   - System opens "Add New Child" form modal or dedicated page

3. **Fill Required Information**
   - Parent enters child's full name (required, 1-50 characters)
   - Parent selects birthdate using date picker (required, validates reasonable age)
   - System automatically calculates and displays child's current age

4. **Add Optional Details**
   - Parent uploads child's photo/avatar (optional, drag-drop or file picker)
   - Parent enters nickname (optional, 1-30 characters)
   - Parent selects grade level from dropdown or enters custom (optional)
   - Parent adds interests using tag input with suggestions (optional)

5. **Review and Submit**
   - Parent reviews entered information in summary section
   - Parent clicks "Create Child Profile" button
   - System validates all fields and shows loading state

6. **Confirmation and Next Steps**
   - System displays success message with child's name
   - New child appears in child management dashboard
   - System offers quick actions: "Set up first chore" or "Add another child"

**Error Handling:**
- Invalid birthdate → "Please enter a valid birthdate"
- Duplicate name → "A child with this name already exists"
- Image too large → "Please choose an image smaller than 5MB"

### 4.2 Edit Child Details Journey

**Step-by-Step Process:**

1. **Access Child for Editing**
   - Parent navigates to Child Management dashboard
   - Parent locates target child in the grid/list view
   - Parent clicks "Edit" button on child's card OR clicks child's name to open profile

2. **Open Edit Form**
   - System opens edit form pre-populated with current child information
   - All fields show existing values (name, birthdate, avatar, etc.)
   - Form clearly indicates which fields are required vs optional

3. **Make Changes**
   - Parent modifies any desired fields (name, nickname, avatar, grade, interests)
   - System provides real-time validation feedback
   - Age automatically recalculates if birthdate is changed
   - Avatar preview updates immediately when new image selected

4. **Save Changes**
   - Parent clicks "Save Changes" button
   - System validates all modified fields
   - System shows loading state during save operation

5. **Confirmation**
   - System displays "Child profile updated successfully" message
   - Updated information reflects immediately in child management dashboard
   - Parent can continue editing or return to main dashboard

**Special Cases:**
- If child has active chores/rewards, system warns before allowing certain changes
- Birthdate changes that significantly affect age show confirmation dialog
- Avatar changes show before/after preview

### 4.3 View Children List Journey

**Step-by-Step Process:**

1. **Navigate to Child Management**
   - Parent accesses Family OS dashboard
   - Clicks "Child Management" in navigation menu
   - System loads child management dashboard

2. **View Children Overview**
   - System displays all children in responsive card grid (2-4 columns)
   - Each child card shows:
     - Avatar (with default if none uploaded)
     - Name and age
     - Current points balance
     - Quick stats (active chores, recent activity)
     - Action menu (edit, view details, archive)

3. **Filter and Sort Options**
   - Parent can toggle "Active Children Only" filter
   - Parent can sort by: Name (A-Z), Age (youngest/oldest), Points (high/low), Recently Added
   - Parent can use search box to find specific child by name

4. **Quick Actions from List**
   - Parent can click child's name → opens detailed child dashboard
   - Parent can click "Edit" → opens edit form
   - Parent can click points balance → shows points history
   - Parent can access bulk actions when multiple children selected

5. **Detailed Child View**
   - Clicking on child opens comprehensive dashboard showing:
     - Complete profile information
     - Points balance and transaction history
     - Active and completed chores
     - Available rewards within point range
     - Recent activity timeline
     - Progress charts and statistics

**Empty State:**
- If no children exist, show welcome message with prominent "Add Your First Child" button
- Include helpful tips about setting up family profiles

**Loading States:**
- Show skeleton cards while children data loads
- Display loading spinner for individual operations
- Provide feedback for all user actions

### 4.4 Navigation Flow Summary

```
Family Dashboard
    ↓
Child Management Dashboard
    ├── Add Child → Form → Success → Back to Dashboard
    ├── Edit Child → Form → Save → Back to Dashboard  
    ├── View Child Details → Child Dashboard → Back to List
    └── Bulk Actions → Confirmation → Execute → Back to Dashboard
```

### 4.5 Mobile User Journey Considerations

**Mobile-Specific Adaptations:**
- Child cards stack in single column on mobile
- Edit forms use full-screen modal on mobile
- Touch-friendly button sizes (minimum 44px)
- Swipe gestures for quick actions on child cards
- Simplified navigation with clear back buttons

## 5. Functional Requirements

### 5.1 Child Profile Management

#### 5.1.1 Create Child Profile
- **REQ-001:** System shall allow parents to create new child profiles
- **REQ-002:** Required fields: name, birthdate
- **REQ-003:** Optional fields: avatar_url, nickname, grade_level, interests
- **REQ-004:** System shall automatically calculate age from birthdate
- **REQ-005:** System shall initialize points_balance to 0 for new children

#### 5.1.2 Edit Child Profile
- **REQ-006:** System shall allow parents to edit all child profile fields
- **REQ-007:** System shall validate birthdate to ensure reasonable age ranges (0-25 years)
- **REQ-008:** System shall maintain audit trail of profile changes
- **REQ-009:** System shall prevent deletion of children with active chores/rewards

#### 5.1.3 Avatar Management
- **REQ-010:** System shall support image upload for child avatars
- **REQ-011:** System shall resize/optimize uploaded images automatically
- **REQ-012:** System shall provide default avatar options
- **REQ-013:** Supported formats: JPG, PNG, WebP (max 5MB)

### 5.2 Child Dashboard and Monitoring

#### 5.2.1 Individual Child Dashboard
- **REQ-014:** System shall display child's current points balance
- **REQ-015:** System shall show active chores and completion status
- **REQ-016:** System shall display recent activity timeline
- **REQ-017:** System shall show available rewards within point range
- **REQ-018:** System shall display progress charts and statistics

#### 5.2.2 Family Overview
- **REQ-019:** System shall provide family-wide child management interface
- **REQ-020:** System shall show summary cards for all children
- **REQ-021:** System shall enable quick actions across multiple children
- **REQ-022:** System shall display family leaderboards and comparisons

### 5.3 Data Management

#### 5.3.1 Data Validation
- **REQ-023:** Name field: 1-50 characters, letters and spaces only
- **REQ-024:** Birthdate: Valid date, not in future, reasonable age range
- **REQ-025:** Avatar URL: Valid image URL or file upload
- **REQ-026:** Points balance: Non-negative integer

#### 5.3.2 Data Security
- **REQ-027:** All child data shall be associated with authenticated parent
- **REQ-028:** Parents can only access their own family's children
- **REQ-029:** Child data shall be encrypted at rest
- **REQ-030:** System shall comply with COPPA requirements for children under 13

## 6. Data Model Specifications

### 6.1 Child Record Structure

#### 6.1.1 Required Fields
- **`id`** (UUID, Primary Key): Unique identifier for each child.
- **`family_id`** (UUID, Foreign Key → `families.id`): Links child to their family unit and enforces family-level row access control.
- **`name`** (VARCHAR(50), NOT NULL): Child's full name (1–50 characters). Must be unique per family when `is_active` = true.
- **`birthdate`** (DATE, NOT NULL): Child's date of birth. Must be a valid date within allowed age range (0–25 years).

#### 6.1.2 Optional Fields
- **`nickname`** (VARCHAR(30)): Preferred name or shortened version.
- **`avatar_url`** (TEXT): URL or storage path to child's profile image. Must be a valid image format (JPG, PNG, WEBP).
- **`grade_level`** (VARCHAR(20)): Current school grade or education level.
- **`interests`** (TEXT[]): Array of hobbies/interest tags.

#### 6.1.3 System Fields
- **`points_balance`** (INTEGER DEFAULT 0, CHECK ≥ 0): Current reward points balance.
- **`is_active`** (BOOLEAN DEFAULT true): Soft-delete flag.
- **`created_at`** (TIMESTAMPTZ DEFAULT NOW()): UTC timestamp when record created.
- **`updated_at`** (TIMESTAMPTZ DEFAULT NOW()): UTC timestamp when record last updated.

#### 6.1.4 Computed/Virtual Fields *(not stored in DB unless cached)*
- **`age`** (INTEGER): Years between `birthdate` and current date.
- **`active_chores_count`** (INTEGER): Computed from related `chore_assignments` where not complete.
- **`completed_chores_count`** (INTEGER): Computed from related `chore_assignments` completed.
- **`total_points_earned`** (INTEGER): Sum of all point-earning activities.

### 6.2 Database Relationships

#### 6.2.1 Family Hierarchy
```
families (1) ←→ (many) profiles ←→ (1) users
families (1) ←→ (many) children
```

**Relationship Details:**
- Each `child` belongs to exactly one `family` via `family_id`
- Each `family` can have multiple `children` (max 10 per business rules)
- Parents access children through their `profile.family_id` association
- Cascading deletes: family deletion removes all associated children

#### 6.2.2 Child-Centric Relationships
```
children (1) ←→ (many) chore_assignments
children (1) ←→ (many) reward_redemptions
children (1) ←→ (many) child_activity_log
children (1) ←→ (many) journal_entries (optional)
```

**Access Control:**
- Parents can only access children where `child.family_id = parent.profile.family_id`
- All child-related operations require family membership validation
- Child data is isolated by family boundaries

#### 6.2.3 Data Integrity Constraints
- **Foreign Key Constraints:** `family_id` must exist in `families` table
- **Check Constraints:** `points_balance >= 0`, valid birthdate range
- **Unique Constraints:** Child names unique within family scope
- **Cascade Rules:** Family deletion cascades to children and related data

### 6.3 Technical Specifications

#### 6.3.1 Enhanced Database Schema

```sql
-- Core children table with comprehensive field definitions
CREATE TABLE children (
  -- Primary identification
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
  
  -- Required profile information
  name VARCHAR(50) NOT NULL,
  birthdate DATE NOT NULL,
  
  -- Optional profile details
  nickname VARCHAR(30),
  avatar_url TEXT,
  grade_level VARCHAR(20),
  interests TEXT[],
  
  -- System tracking fields
  points_balance INTEGER DEFAULT 0 CHECK (points_balance >= 0),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Business rule constraints
  CONSTRAINT valid_age CHECK (
    birthdate >= CURRENT_DATE - INTERVAL '25 years' AND 
    birthdate <= CURRENT_DATE
  ),
  CONSTRAINT unique_child_name_per_family UNIQUE (family_id, name, is_active)
);

-- Child activity tracking for audit and analytics
CREATE TABLE child_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES children(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL, -- 'chore_completed', 'reward_redeemed', 'points_earned', 'profile_updated'
  description TEXT,
  points_change INTEGER DEFAULT 0,
  metadata JSONB, -- Flexible storage for activity-specific data
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Supporting tables for family structure
CREATE TABLE families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  family_id UUID REFERENCES families(id) ON DELETE SET NULL,
  display_name VARCHAR(100),
  role VARCHAR(20) DEFAULT 'parent', -- 'parent', 'guardian', 'admin'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance and query optimization indexes
CREATE INDEX idx_children_family_id ON children(family_id);
CREATE INDEX idx_children_active ON children(family_id, is_active);
CREATE INDEX idx_children_name ON children(family_id, name);
CREATE INDEX idx_child_activity_child_id ON child_activity_log(child_id);
CREATE INDEX idx_child_activity_date ON child_activity_log(created_at);
CREATE INDEX idx_child_activity_type ON child_activity_log(child_id, activity_type);

-- Row Level Security (RLS) policies for data protection
ALTER TABLE children ENABLE ROW LEVEL SECURITY;
ALTER TABLE child_activity_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access children from their family
CREATE POLICY "Users can access family children" ON children
  FOR ALL USING (
    family_id IN (
      SELECT family_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Policy: Users can only access activity logs for their family's children
CREATE POLICY "Users can access family child activity" ON child_activity_log
  FOR ALL USING (
    child_id IN (
      SELECT c.id FROM children c
      JOIN profiles p ON c.family_id = p.family_id
      WHERE p.id = auth.uid()
    )
  );
```

#### 6.3.2 Data Validation Rules

**Field Validation:**
- `name`: Required, 1-50 characters, letters/spaces/hyphens/apostrophes only
- `birthdate`: Required, valid date, not in future, reasonable age range (0-25 years)
- `nickname`: Optional, 1-30 characters, same character rules as name
- `avatar_url`: Optional, valid URL or file path, image formats only
- `grade_level`: Optional, predefined list + custom option
- `interests`: Optional array, each item 1-30 characters
- `points_balance`: System managed, non-negative integer

**Business Logic Validation:**
- Child names must be unique within each family
- Maximum 10 children per family
- Birthdate changes require confirmation if age significantly changes
- Points balance modifications require audit trail
```

### 6.4 API Data Contracts

#### 6.4.1 Child Data Transfer Objects

**Child Response DTO:**
```typescript
interface ChildResponse {
  id: string;
  family_id: string;
  name: string;
  nickname?: string;
  birthdate: string; // ISO date string
  avatar_url?: string;
  grade_level?: string;
  interests?: string[];
  points_balance: number;
  is_active: boolean;
  created_at: string; // ISO datetime string
  updated_at: string; // ISO datetime string
  
  // Computed fields (when requested)
  age?: number;
  active_chores_count?: number;
  completed_chores_count?: number;
  total_points_earned?: number;
}
```

**Child Create/Update DTO:**
```typescript
interface ChildCreateRequest {
  name: string; // Required
  birthdate: string; // Required, ISO date
  nickname?: string;
  avatar_url?: string;
  grade_level?: string;
  interests?: string[];
}

interface ChildUpdateRequest {
  child_id: string; // Required for updates
  name?: string;
  birthdate?: string;
  nickname?: string;
  avatar_url?: string;
  grade_level?: string;
  interests?: string[];
}
```

### 6.5 API Endpoints

#### 6.2.1 Child CRUD Operations

**GET /api/children**
- Returns list of all children for authenticated family
- Query params: `active_only=true`, `include_stats=true`

**POST /api/children**
- Creates new child profile
- Body: `{ name, birthdate, avatar_url?, nickname?, grade_level?, interests? }`

**PUT /api/children**
- Updates existing child profile
- Body: `{ child_id, name?, birthdate?, avatar_url?, nickname?, grade_level?, interests? }`

**DELETE /api/children**
- Soft deletes child (sets is_active = false)
- Body: `{ child_id }`
- Validates no active dependencies

#### 6.2.2 Child Dashboard and Analytics

**GET /api/children/:id/dashboard**
- Returns comprehensive dashboard data
- Includes: points, active chores, recent activity, available rewards

**GET /api/children/:id/activity**
- Returns paginated activity log
- Query params: `limit`, `offset`, `activity_type`, `date_from`, `date_to`

**POST /api/children/:id/points**
- Manual points adjustment (admin function)
- Body: `{ points_change, reason, admin_override? }`

#### 6.2.3 Avatar Management

**POST /api/children/:id/avatar**
- Uploads and sets child avatar
- Multipart form data with image file

**DELETE /api/children/:id/avatar**
- Removes child avatar (sets to default)

### 6.3 Component Architecture

#### 6.3.1 React Components

```typescript
// Core child management components
- ChildManagement.tsx (main container)
- ChildList.tsx (displays all children)
- ChildCard.tsx (individual child summary)
- ChildForm.tsx (create/edit form)
- ChildDashboard.tsx (detailed child view)
- ChildAvatar.tsx (avatar display/upload)
- ChildActivityFeed.tsx (activity timeline)
- ChildStats.tsx (charts and statistics)

// Supporting components
- AvatarUpload.tsx (file upload handling)
- PointsDisplay.tsx (points balance with formatting)
- AgeCalculator.tsx (age display from birthdate)
- ChildSelector.tsx (dropdown for child selection)
```

#### 6.3.2 State Management

```typescript
// Child management state
interface ChildState {
  children: Child[];
  selectedChild: Child | null;
  loading: boolean;
  error: string | null;
  filters: {
    activeOnly: boolean;
    sortBy: 'name' | 'age' | 'points' | 'created_at';
    sortOrder: 'asc' | 'desc';
  };
}

// Child data interface
interface Child {
  id: string;
  family_id: string;
  name: string;
  nickname?: string;
  birthdate: string;
  avatar_url?: string;
  points_balance: number;
  grade_level?: string;
  interests?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  
  // Computed fields
  age?: number;
  active_chores_count?: number;
  completed_chores_count?: number;
  total_points_earned?: number;
}
```

## 7. User Interface Specifications

### 7.1 Child Management Dashboard

#### 7.1.1 Layout Structure
- **Header:** "Child Management" with "Add Child" button
- **Filter Bar:** Active/All toggle, sort options, search
- **Child Grid:** Responsive card layout (2-4 columns based on screen size)
- **Quick Actions:** Bulk operations toolbar when children selected

#### 7.1.2 Child Card Design
- **Avatar:** Circular image (80x80px) with default fallback
- **Name & Age:** Primary heading with calculated age
- **Points Balance:** Prominent display with icon
- **Quick Stats:** Active chores, recent activity count
- **Action Menu:** Edit, view dashboard, archive options

### 7.2 Child Form (Create/Edit)

#### 7.2.1 Form Fields
- **Name:** Required text input with validation
- **Nickname:** Optional text input
- **Birthdate:** Date picker with age preview
- **Avatar:** Image upload with preview and crop
- **Grade Level:** Dropdown with common options + custom
- **Interests:** Tag input with suggestions

#### 7.2.2 Form Validation
- Real-time validation with error messages
- Age calculation and display
- Image preview and size validation
- Save/cancel actions with confirmation

### 7.3 Child Dashboard

#### 7.3.1 Dashboard Sections
- **Header:** Child name, avatar, key stats
- **Points Overview:** Current balance, recent changes, trends
- **Active Chores:** List with completion status and due dates
- **Recent Activity:** Timeline of points earned/spent
- **Available Rewards:** Filtered by current points balance
- **Progress Charts:** Weekly/monthly activity visualization

## 8. Business Rules

### 8.1 Child Management Rules
- **BR-001:** Maximum 10 children per family account
- **BR-002:** Child names must be unique within family
- **BR-003:** Children under 13 require additional privacy protections
- **BR-004:** Archived children retain historical data but cannot earn new points
- **BR-005:** Points balance cannot go negative through normal operations

### 8.2 Data Retention Rules
- **BR-006:** Child profiles retained for 7 years after archival
- **BR-007:** Activity logs retained for 2 years
- **BR-008:** Avatar images deleted immediately upon removal
- **BR-009:** Personal data purged upon family account deletion

## 9. Integration Points

### 9.1 Existing System Integration
- **Chores System:** Children assigned to chores, earn points upon completion
- **Rewards System:** Children redeem points for rewards
- **Journal System:** Optional child-specific journal entries
- **Family Profiles:** Children linked to family hierarchy

### 9.2 Future Integration Opportunities
- **Calendar Integration:** Child-specific events and schedules
- **Educational Tracking:** School performance and homework
- **Health Monitoring:** Growth charts, medical appointments
- **Social Features:** Child-to-child interactions and messaging

## 10. Permissions and Access Control

### 10.1 User Role Definitions

#### 10.1.1 Family Roles
- **Primary Parent/Guardian:** Full administrative access to all family data
- **Secondary Parent/Guardian:** Full access to child management within family
- **Extended Family Member:** Limited read-only access (configurable)
- **Child User:** Limited self-view access (age-appropriate, future enhancement)

#### 10.1.2 Permission Levels
- **Full Access:** Create, read, update, delete child profiles and all related data
- **Read-Only Access:** View child profiles and activity data only
- **Limited Access:** View basic child information only (name, age)
- **No Access:** Cannot view or interact with child data

### 10.2 Child Information Access Rules

#### 10.2.1 View Permissions
**Who can VIEW child information:**

1. **Family Members Only**
   - Users must be authenticated and belong to the same family
   - Verified through `profiles.family_id` matching `children.family_id`
   - No cross-family access permitted under any circumstances

2. **Role-Based Viewing**
   - **Parents/Guardians:** Can view all child data including:
     - Complete profile information (name, birthdate, avatar, etc.)
     - Points balance and transaction history
     - Chore assignments and completion status
     - Activity logs and behavioral data
     - Reward redemption history
   
   - **Extended Family:** Can view limited data (if enabled):
     - Basic profile (name, age, avatar)
     - Current points balance
     - Recent achievements/milestones
     - No access to detailed activity logs or behavioral data

3. **Data Sensitivity Levels**
   - **Public within Family:** Name, age, avatar, current points
   - **Restricted within Family:** Birthdate, detailed activity logs, behavioral notes
   - **Admin Only:** Account settings, privacy controls, audit logs

#### 10.2.2 Edit Permissions
**Who can EDIT child information:**

1. **Primary Permissions**
   - **Parents/Guardians:** Full edit access to all child data
   - **Extended Family:** No edit permissions by default
   - **System Administrators:** Emergency access only with audit trail

2. **Field-Level Edit Controls**
   - **Basic Profile Fields** (name, nickname, avatar): All parents
   - **Sensitive Fields** (birthdate): Primary parent + confirmation required
   - **System Fields** (points_balance): Automated system + manual admin override
   - **Privacy Settings:** Primary parent only

3. **Edit Restrictions**
   - Cannot edit child data if not authenticated
   - Cannot edit children from other families
   - Cannot delete children with active dependencies (chores, rewards)
   - Significant changes require confirmation dialogs

#### 10.2.3 Administrative Permissions
**Who can perform ADMINISTRATIVE actions:**

1. **Create Child Profiles**
   - Any authenticated family member with parent/guardian role
   - Must belong to a valid family unit
   - Subject to family size limits (max 10 children)

2. **Delete/Archive Child Profiles**
   - Primary parent/guardian only
   - Requires confirmation and reason
   - Soft delete preserves historical data
   - Cannot delete if active chores/rewards exist

3. **Manage Privacy Settings**
   - Primary parent/guardian only
   - Controls extended family access levels
   - Sets age-appropriate privacy protections
   - Manages COPPA compliance settings

### 10.3 Technical Access Control Implementation

#### 10.3.1 Database-Level Security
```sql
-- Row Level Security policies ensure family data isolation
CREATE POLICY "family_children_access" ON children
  FOR ALL USING (
    family_id IN (
      SELECT family_id FROM profiles 
      WHERE id = auth.uid() AND family_id IS NOT NULL
    )
  );

-- Prevent cross-family data access
CREATE POLICY "prevent_cross_family_access" ON children
  FOR ALL USING (
    NOT EXISTS (
      SELECT 1 FROM profiles p1, profiles p2
      WHERE p1.id = auth.uid() 
      AND p2.family_id = children.family_id
      AND p1.family_id != p2.family_id
    )
  );
```

#### 10.3.2 API-Level Security
- **Authentication Required:** All endpoints require valid JWT token
- **Family Validation:** Every request validates user's family membership
- **Resource Ownership:** Users can only access their family's children
- **Rate Limiting:** Prevents abuse and unauthorized access attempts

#### 10.3.3 Application-Level Security
- **Component Guards:** React components check permissions before rendering
- **Route Protection:** Navigation guards prevent unauthorized page access
- **Action Validation:** User actions validated against permission matrix
- **Error Handling:** Graceful degradation for insufficient permissions

### 10.4 Permission Matrix

| Action | Primary Parent | Secondary Parent | Extended Family | Child User | Anonymous |
|--------|---------------|------------------|-----------------|------------|-----------|
| View Basic Profile | ✅ | ✅ | ✅* | ✅** | ❌ |
| View Detailed Profile | ✅ | ✅ | ❌ | ✅** | ❌ |
| View Points/Rewards | ✅ | ✅ | ✅* | ✅** | ❌ |
| View Activity Logs | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit Basic Info | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit Sensitive Info | ✅ | ⚠️*** | ❌ | ❌ | ❌ |
| Create Child | ✅ | ✅ | ❌ | ❌ | ❌ |
| Delete Child | ✅ | ⚠️*** | ❌ | ❌ | ❌ |
| Manage Privacy | ✅ | ❌ | ❌ | ❌ | ❌ |
| Admin Override | ✅ | ❌ | ❌ | ❌ | ❌ |

**Legend:**
- ✅ = Full Access
- ⚠️ = Conditional Access (requires confirmation/approval)
- ❌ = No Access
- \* = If enabled by primary parent
- \** = Own profile only, age-appropriate restrictions
- \*** = Requires primary parent approval

### 10.5 Privacy Protection Measures

#### 10.5.1 Age-Based Protections
- **Children Under 13:** Enhanced COPPA compliance
  - Minimal data collection
  - Parental consent required for all features
  - No behavioral tracking without explicit consent
  - Limited third-party integrations

- **Children 13-17:** Teen privacy protections
  - Opt-in for detailed tracking
  - Parental oversight with teen input
  - Gradual permission increases with age

#### 10.5.2 Data Minimization
- Collect only necessary data for functionality
- Regular data purging of inactive/old records
- User-controlled data retention settings
- Clear data deletion procedures

#### 10.5.3 Consent Management
- Explicit parental consent for data collection
- Granular consent for different data types
- Easy consent withdrawal mechanisms
- Regular consent renewal requirements

### 10.6 Audit and Compliance

#### 10.6.1 Access Logging
- All child data access logged with timestamps
- User identification and action tracking
- Failed access attempt monitoring
- Regular audit report generation

#### 10.6.2 Compliance Monitoring
- COPPA compliance verification
- GDPR data protection compliance
- Regular security assessments
- Privacy impact assessments for new features

## 11. Security and Privacy

### 11.1 Data Protection
- All child data encrypted at rest and in transit
- Access controls based on family membership
- Audit logging for all child data modifications
- COPPA compliance for children under 13

### 11.2 Privacy Controls
- Parents control child data visibility
- Option to limit data collection for younger children
- Clear data retention and deletion policies
- Parental consent required for all data processing

## 11. Performance Requirements

### 11.1 Response Time Targets
- Child list loading: < 500ms
- Child dashboard loading: < 1s
- Form submissions: < 300ms
- Image uploads: < 5s for 5MB files

### 11.2 Scalability Targets
- Support 1000+ families simultaneously
- Handle 10,000+ child profiles
- Process 100,000+ activity log entries daily
- 99.9% uptime availability

## 12. Testing Strategy

### 12.1 Unit Testing
- Component rendering and interaction tests
- API endpoint validation tests
- Business logic and calculation tests
- Form validation and error handling tests

### 12.2 Integration Testing
- End-to-end child management workflows
- Cross-feature integration (chores, rewards)
- Database transaction integrity
- File upload and image processing

### 12.3 User Acceptance Testing
- Parent user journey testing
- Mobile responsiveness validation
- Accessibility compliance testing
- Performance testing under load

## 13. Deployment and Rollout

### 13.1 Phased Rollout Plan
- **Phase 1:** Basic CRUD operations and child profiles
- **Phase 2:** Dashboard and activity tracking
- **Phase 3:** Advanced features and analytics
- **Phase 4:** Mobile optimization and performance tuning

### 13.2 Migration Strategy
- Existing child data migration from current schema
- Backward compatibility during transition period
- Data validation and cleanup procedures
- Rollback plan for critical issues

## 14. Success Metrics

### 14.1 Adoption Metrics
- Percentage of families with child profiles created
- Average number of children per family
- Child profile completion rates
- Feature usage analytics

### 14.2 Engagement Metrics
- Daily/weekly active child profiles
- Parent interaction frequency with child management
- Time spent in child dashboards
- Feature utilization rates

### 14.3 Quality Metrics
- Error rates and system reliability
- User satisfaction scores
- Support ticket volume related to child management
- Performance benchmark achievement

## 15. Future Enhancements

### 15.1 Short-term Enhancements (3-6 months)
- Bulk import/export of child data
- Advanced filtering and search capabilities
- Child profile templates and presets
- Enhanced mobile experience

### 15.2 Long-term Enhancements (6-12 months)
- AI-powered insights and recommendations
- Integration with external educational platforms
- Advanced analytics and reporting
- Multi-language support for child interfaces

---

**Document Status:** Draft for Review  
**Next Review Date:** 2025-08-11  
**Stakeholders:** Product Team, Engineering Team, UX Team, QA Team
