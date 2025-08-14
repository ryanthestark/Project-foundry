# Family OS: A Unified System for High-Output Living

**Author:** Lead Product Manager (Researcher Aider)
**Version:** 1.0
**Date:** 2025-08-04

## 1. Product Vision & Core Value Proposition

The Family OS is an integrated life management system designed to help high-achieving individuals maximize their income, optimize their health, and enrich their family life by providing a unified, intelligent, and secure platform for decision-making and execution. It is built on the principle that personal and professional productivity are not separate domains but are deeply interconnected. By providing a single, secure source of truth for all life domains, the Family OS empowers its users to achieve holistic, high-output living.

## 2. User Persona: "User 0 - The High-IPH Optimizer"

*   **Profile:** A highly driven professional in the cybersecurity sales/management field, managing a portfolio of high-income W2 roles.
*   **Goals:**
    1.  **Maximize Income Per Hour (IPH):** To work a highly efficient 20-30 hour week while maximizing income, with a system to evaluate new opportunities.
    2.  **Optimize Health:** To achieve a specific, aggressive wellness goal (reduce body fat from 30% to 10%).
    3.  **Enrich Family Life:** To manage home life efficiently and make strategic family decisions, ensuring that professional ambition actively supports, rather than detracts from, quality family time.
*   **Core Pains:**
    *   **System Fragmentation:** Currently uses a disparate set of tools (multiple calendars, task managers, note apps) leading to cognitive overhead and lost productivity.
    *   **Lack of Integration:** No unified view across life domains (work, health, family, finance).
    *   **Security & Privacy Risk:** A critical need to maintain a strict separation between professional and personal data and systems.

## 3. Foundational Epic 1: The "Air-Gapped" Architecture

This is a non-negotiable, foundational requirement of the entire system.

*   **Requirement:** The Family OS must be architected to ensure a complete "air gap" between the user's personal data and any employer-owned systems.
*   **Specification:** The application will be designed for use exclusively on personal hardware (e.g., personal iPhone, personal MacBook). It must never be installed on or accessed from an employer-issued device. All user data must be stored in a personal, encrypted cloud database (Supabase), with access strictly controlled by user-owned credentials.

## 4. Product Epic 2: The "W2 Portfolio" Hub

This epic addresses the user's need to manage their professional life as a portfolio of high-leverage roles.

*   **Activity-Based Time & Income Tracking:** A module to log hours worked and income received (salary, commission) for each W2 role. Crucially, time entries must be taggable with the specific **Activity** (e.g., "Prospecting," "Coaching," "Admin").
*   **Advanced IPH Dashboard:** A dashboard that provides a real-time calculation and visualization of IPH. This must include:
    *   IPH calculated per role and per activity, to identify the highest-leverage work.
    *   A visual representation of the data-driven **"IPH Floor"** (e.g., a baseline on the chart) to show if a role is performing above or below the critical threshold.
    *   A "Blended IPH" calculator to analyze performance over custom periods (e.g., 90 days), combining base salary/draw with commissions.
*   **Pipeline Value Tracker:** For sales-based roles, a simple tracker for key funnel metrics (e.g., Pipeline Value, Close Rate) to provide leading indicators of future IPH.
*   **Role Opportunity Analyzer:** A feature to model the potential impact of adding a new W2 role. The user can input projected income and required hours to see how it would affect their total IPH and available time.

## 5. Product Epic 3: The "Wellness Engine"

This epic is designed to support the user's specific and measurable health goals.

*   **Workout Planner & Logger:** A module to schedule workouts and log completed sessions, including details like exercises, sets, reps, and weights.
*   **Nutrition Tracker:** A simple interface for tracking daily nutrition, focusing on key metrics like total calories and macronutrients (protein, carbs, fat).
*   **Progress Dashboard:** A dedicated dashboard to track progress towards the 10% body fat goal, visualizing metrics like weight, calculated body fat percentage, and progress photos over time.

## 6. Product Epic 4: The "Family & Home Command Center"

This epic focuses on managing the user's home life and supporting major family decisions.

*   **Shared Family Calendar:** A unified calendar, integrated with the user's personal calendar, to schedule and protect dedicated family time, vacations, and children's events.
*   **Home Maintenance System:** A task management subsystem specifically for recurring home maintenance (e.g., "Change air filters," "Clean gutters") and one-off repair projects.
*   **Strategic Decision Module:** A project-based module for major life decisions. For the "Project Southwest Move" example, this would allow the user to create a dedicated space to:
    *   Gather research and notes on different states (TX, NV, AZ).
    *   Create pros/cons lists for each option.
    *   Track a checklist of tasks related to the decision (e.g., "Schedule exploratory visit," "Consult with accountant").

## 7. Product Epic 5: The "Unified Workflow"

This epic is about creating a single, seamless experience that eliminates the user's current system fragmentation.

*   **Unified Calendar:** A single calendar view that can display events from all life domains (Work, Health, Family, Personal) with clear color-coding and filtering.
*   **Unified Task Manager:** A single, powerful task manager where tasks from all epics (work, health, home) can be viewed, prioritized, and managed in one place.
*   **Unified Notes & Journal:** A central repository for all notes, thoughts, and daily journaling. Crucially, notes must be linkable to tasks, calendar events, and projects, creating a web of interconnected context.

## 8. Product Epic 6: The "Low-Overhead Finance" Module

This epic addresses the need for a simple, effective financial management system, learning from the user's negative experience with the high-overhead YNAB.

*   **Focus on Key Metrics:** The system will not require detailed, transaction-by-transaction budgeting. Instead, it will focus on high-level indicators of financial health.
*   **Net Worth Tracker:** A module to track total assets and liabilities over time.
*   **Savings Rate Calculator:** A simple tool to calculate and visualize the monthly and annual savings rate.
*   **Major Category Spending:** An optional module for tracking spending in a few major, user-defined categories (e.g., Housing, Food, Transportation) to identify major trends without granular effort.
