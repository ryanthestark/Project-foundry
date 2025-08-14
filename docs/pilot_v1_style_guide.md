# Pilot V1: Visual Asset & Style Guide

**Author:** Designer Aider
**Status:** Draft
**Version:** 1.0
**Date:** 2025-08-03
**Reference Docs:**
- `docs/design/pilot_v1_mockups.md`
- `docs/design/visual_identity_and_polish_guide.md`

## 1. Overview

This document is a quick-reference guide for Engineers implementing the "Pilot V1" UI. It provides specific, reusable design tokens and assets extracted from the high-fidelity mockups to ensure perfect visual consistency.

---

## 2. Color Palette Variables

These colors should be defined in the `tailwind.config.js` file for easy use throughout the application.

### 2.1. Light Mode

-   **Background:** `background: '#FFFFFF'` (white)
-   **Foreground:** `foreground: '#030712'` (gray-950)
-   **Card:** `card: '#FFFFFF'`, `card-foreground: '#030712'`
-   **Primary:** `primary: '#1D4ED8'`, `primary-foreground: '#F9FAFB'` (blue-700, gray-50)
-   **Secondary:** `secondary: '#F3F4F6'`, `secondary-foreground: '#1F2937'` (gray-100, gray-800)
-   **Muted:** `muted: '#F3F4F6'`, `muted-foreground: '#6B7280'` (gray-100, gray-500)
-   **Accent:** `accent: '#F3F4F6'`, `accent-foreground: '#1F2937'` (gray-100, gray-800)
-   **Destructive:** `destructive: '#DC2626'`, `destructive-foreground: '#F9FAFB'` (red-600, gray-50)
-   **Border:** `border: '#E5E7EB'` (gray-200)
-   **Input:** `input: '#E5E7EB'` (gray-200)
-   **Ring:** `ring: '#3B82F6'` (blue-500)

### 2.2. Dark Mode

-   **Background:** `background: '#030712'` (gray-950)
-   **Foreground:** `foreground: '#F9FAFB'` (gray-50)
-   **Card:** `card: '#030712'`, `card-foreground: '#F9FAFB'`
-   **Primary:** `primary: '#3B82F6'`, `primary-foreground: '#F9FAFB'` (blue-500, gray-50)
-   **Secondary:** `secondary: '#1F2937'`, `secondary-foreground: '#F9FAFB'` (gray-800, gray-50)
-   **Muted:** `muted: '#1F2937'`, `muted-foreground: '#9CA3AF'` (gray-800, gray-400)
-   **Accent:** `accent: '#1F2937'`, `accent-foreground: '#F9FAFB'` (gray-800, gray-50)
-   **Destructive:** `destructive: '#EF4444'`, `destructive-foreground: '#F9FAFB'` (red-500, gray-50)
-   **Border:** `border: '#1F2937'` (gray-800)
-   **Input:** `input: '#1F2937'` (gray-800)
-   **Ring:** `ring: '#1D4ED8'` (blue-700)

### 2.3. Gradients

-   **Primary Accent Gradient:** `from-purple-500 to-blue-500`

---

## 3. Iconography (Lucide React)

The following icons are used in the mockups.

-   `LayoutDashboard`
-   `ListChecks`
-   `BookHeart`
-   `FileText`
-   `MessageSquarePlus`
-   `BrainCircuit`
-   `LogOut`
-   `CheckCircle`
-   `Search`
-   `Bell`
-   `UserPlus`
-   `UploadCloud`
-   `MoreHorizontal`
-   `Users`
-   `MapPin`
-   `Wrench`
-   `ClipboardList`
-   `PlusCircle`

---

## 4. Font Styles (Tailwind CSS)

-   **H1 (Page Title):** `text-3xl font-bold`
-   **H2 (Card Title):** `text-xl font-semibold`
-   **H3 (Sub-heading):** `text-lg font-medium`
-   **Body:** `text-base font-normal`
-   **Description/Muted Text:** `text-sm text-muted-foreground`

---

## 5. Component States

-   **Primary Button (Gradient):**
    -   **Default:** `bg-gradient-to-r from-purple-500 to-blue-500 text-white`
    -   **Hover:** Brighter gradient, subtle lift (`hover:shadow-md`). Achieved by adjusting gradient stops or applying a filter.
-   **Secondary Button (Outline):**
    -   **Default:** `border border-primary text-primary bg-transparent`
    -   **Hover:** `bg-primary/10` (A semi-transparent wash of the primary color).
-   **Input Field:**
    -   **Default:** `border-input`
    -   **Focus:** `focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`
-   **Navigation Link (Sidebar):**
    -   **Default:** `text-gray-400`
    -   **Hover:** `bg-gray-800 text-white`
    -   **Active:** `bg-gray-800 text-white` with a vertical `bg-blue-600` accent bar on the left.
