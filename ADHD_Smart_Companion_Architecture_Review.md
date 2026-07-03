# ADHD Smart Companion -- Architecture Review, Limitations, and Alternative Solutions

> This document analyzes the current architecture described in the
> project README and proposes production-ready improvements.

## Executive Summary

The current system follows a clean modular architecture:

``` text
User Goal
    ↓
Frontend (Next.js / Streamlit)
    ↓
FastAPI Backend
    ↓
SmolVLM (Scene Understanding)
    ↓
Qwen 2.5 3B (Task Planning)
    ↓
Micro-step
    ↓
User Feedback
    ↓
Repeat
```

Strengths include modularity, privacy (local inference), and simple
orchestration. However, the system can evolve significantly by improving
planning, memory, perception, personalization, and safety.

------------------------------------------------------------------------

# 1. Static Image Understanding

## Current limitation

The VLM analyzes only the current frame and cannot determine what
changed between frames.

### Problems

-   Cannot detect completed actions.
-   No temporal understanding.
-   Cannot infer object movement.

## Proposed solution: Scene Difference Engine

``` text
Previous Frame
      │
Current Frame
      │
      ▼
Scene Comparator
      │
      ▼
Added / Removed / Moved Objects
```

### Benefits

-   Detect completed actions automatically.
-   Better continuity.
-   Fewer repeated instructions.

------------------------------------------------------------------------

# 2. No Long-Term Planning

## Current limitation

The LLM generates one instruction at a time.

### Problems

-   Repeated reasoning
-   Inconsistent ordering
-   No roadmap

## Proposed solution: Hierarchical Planner

``` text
Goal
 ↓
Master Plan
 ↓
Task
 ↓
Micro Steps
```

### Benefits

-   Consistent execution
-   Easy progress tracking
-   Faster inference

------------------------------------------------------------------------

# 3. Binary Feedback

## Current limitation

Only: - Completed - Not Completed

## Proposed solution

Support richer feedback:

-   Completed
-   Skipped
-   Need Help
-   Confused
-   Cannot Find Object
-   Distracted
-   Need Break
-   Wrong Instruction

### Benefits

-   Better adaptation
-   Personalized recovery

------------------------------------------------------------------------

# 4. No User Memory

## Current limitation

Every session starts from scratch.

## Proposed solution

Persistent user profile storing:

-   Preferred pace
-   Working hours
-   Break interval
-   Frequently misplaced objects
-   Motivation style
-   Voice preference
-   Attention span

### Benefits

-   Personalization
-   Better recommendations
-   Reduced repetitive setup

------------------------------------------------------------------------

# 5. No Object Tracking

## Current limitation

Objects are rediscovered every frame.

## Proposed solution

Persistent object IDs across frames.

### Benefits

-   Track movement
-   Understand completed actions
-   Better scene awareness

------------------------------------------------------------------------

# 6. Weak Context Awareness

## Current limitation

Uses only:

-   Goal
-   Image
-   History

## Missing context

-   Time
-   Calendar
-   Deadline
-   Battery
-   Network
-   Location

## Proposed solution

Unified Context Manager.

### Benefits

Context-aware decisions.

------------------------------------------------------------------------

# 7. No Confidence Estimation

## Current limitation

Incorrect detections immediately influence planning.

## Proposed solution

Confidence threshold.

If confidence is low:

-   Ask user
-   Request another image

### Benefits

Reduced hallucinations.

------------------------------------------------------------------------

# 8. Hallucinated Objects

## Current limitation

LLM may mention objects not detected.

## Proposed solution

Grounded prompting using detected object list only.

### Benefits

Higher reliability.

------------------------------------------------------------------------

# 9. Missing Task Dependencies

## Current limitation

Tasks execute sequentially.

## Proposed solution

Directed task graph.

Example:

Charge Laptop ↓ Power On ↓ Login ↓ Open IDE

### Benefits

Logical execution.

------------------------------------------------------------------------

# 10. Poor Recovery Strategy

## Current limitation

Repeated failures produce repeated instructions.

## Proposed solution

Recovery engine.

After repeated failures:

-   simplify task
-   offer alternative
-   ask why
-   enable voice guidance

------------------------------------------------------------------------

# 11. No ADHD State Modeling

## Current limitation

Every user receives identical coaching.

## Proposed solution

Estimate user state:

-   Focused
-   Distracted
-   Overwhelmed
-   Hyperfocused
-   Tired
-   Frustrated

Adjust instruction style accordingly.

------------------------------------------------------------------------

# 12. Weak Motivation

## Current limitation

Minimal reinforcement.

## Proposed solution

Gamification:

-   XP
-   Achievements
-   Daily streak
-   Progress bar
-   Positive reinforcement

------------------------------------------------------------------------

# 13. Limited Input Modalities

## Current limitation

Camera only.

## Proposed solution

Support:

-   Voice
-   Text
-   Screen capture
-   Clipboard
-   Keyboard events

------------------------------------------------------------------------

# 14. No Environment Awareness

Detect:

-   Lighting
-   Noise
-   Device battery
-   Internet quality

Suggest environmental improvements before continuing.

------------------------------------------------------------------------

# 15. Reactive Execution

## Current limitation

Planning begins only after each user response.

## Proposed solution

Predictive planner.

Generate the next several likely steps in advance.

Benefits:

-   Lower latency
-   Smoother interaction

------------------------------------------------------------------------

# 16. No Retrieval-Augmented Knowledge

## Proposed solution

Integrate RAG for:

-   Personal notes
-   Checklists
-   Documents
-   Manuals

Benefits:

-   Personalized guidance
-   Less hallucination

------------------------------------------------------------------------

# 17. No Validation Layer

Insert a validator after the LLM.

Checks:

-   Object exists
-   Safe action
-   No repetition
-   Appropriate length
-   Logical consistency

------------------------------------------------------------------------

# Recommended Production Architecture

``` text
                      User Goal
                          │
                          ▼
                 Context Manager
      (Time • Calendar • Memory • History)
                          │
                          ▼
              Hierarchical Planner
                          │
                          ▼
──────────────────────────────────────────────
 Camera → VLM → Object Tracker → Scene Diff
──────────────────────────────────────────────
                          │
                          ▼
                   State Manager
                          │
                          ▼
               Grounded Planning LLM
                          │
                          ▼
              Instruction Validator
                          │
                          ▼
      Frontend (Voice • XP • UI • Feedback)
                          │
                          ▼
         Adaptive Coach + User Memory
```

# Priority Roadmap

  Priority     Feature                   Impact      Complexity
  ------------ ------------------------- ----------- ------------
  ⭐⭐⭐⭐⭐   Hierarchical planner      Very High   Medium
  ⭐⭐⭐⭐⭐   Scene difference engine   Very High   Medium
  ⭐⭐⭐⭐⭐   User memory               Very High   Medium
  ⭐⭐⭐⭐☆    Rich feedback             High        Low
  ⭐⭐⭐⭐☆    Instruction validator     High        Low
  ⭐⭐⭐⭐☆    Confidence estimation     High        Medium
  ⭐⭐⭐⭐☆    Object tracking           High        High
  ⭐⭐⭐☆☆     Predictive planning       Medium      Medium
  ⭐⭐⭐☆☆     Environment awareness     Medium      Medium
  ⭐⭐⭐☆☆     RAG integration           Medium      Medium
  ⭐⭐☆☆☆      Multi-modal inputs        Medium      High
  ⭐⭐☆☆☆      Advanced gamification     Medium      Low

# Conclusion

The current architecture is an excellent MVP with clear modular
boundaries. By adding planning, memory, temporal perception, validation,
adaptive coaching, and contextual reasoning, it can evolve into a
production-grade AI companion that is substantially more reliable,
personalized, and effective for users with ADHD.
