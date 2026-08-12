# Zodiac CRM

PRD: Sales CRM Application

1. Executive Summary

Build a clean, modern, single-tenant/multi-tenant Sales CRM application inspired by enterprise CRM layouts (like Zoho CRM). The platform will allow sales teams to manage leads, contacts, accounts, deals (pipelines), and activities (tasks, meetings, calls) with a structured database and clean UI.

2. Core Navigation & Layout Structure

Sidebar (Dark Theme):

Top Section: Logo, Workspace Selector (e.g., "CRM Teamspace").

Main Navigation:

General: Home, Reports, Analytics, Agents.

Sales: Leads, Contacts, Accounts, Deals, Forecasts, Documents, Campaigns.

Activities: Tasks, Meetings, Calls.

Inventory & Modules: Products, Price Books, Quotes, Sales Orders, Invoices.

Top Header:

Global search bar across records (Search records).

Quick Creation Button (+) to quickly add Leads/Contacts/Deals.

Notifications, Calendar view switcher, and User Profile.

Main Content Area:

Sub-header with Filter controls, Search within view, View Switcher (List, Kanban, Sheet, Tile), and primary action button (e.g., Create Contact).

Left sidebar filter panel (Filter by fields, System Defined Filters).

Main data table displaying records with selection checkboxes, record status badges, and column headers.

3. Database Schema (Supabase / PostgreSQL)

accounts

id (uuid, primary key)

name (text, required)

website (text)

phone (text)

created_at (timestamp)

contacts

id (uuid, primary key)

first_name (text)

last_name (text, required)

email (text)

phone (text)

account_id (uuid, foreign key $\rightarrow$ accounts.id)

owner_id (uuid, foreign key $\rightarrow$ users.id)

last_activity_date (date)

created_at (timestamp)

leads

id (uuid, primary key)

first_name (text)

last_name (text)

company (text)

email (text)

status (enum: 'New', 'Contacted', 'Qualified', 'Unqualified')

created_at (timestamp)

deals

id (uuid, primary key)

deal_name (text, required)

account_id (uuid, foreign key $\rightarrow$ accounts.id)

contact_id (uuid, foreign key $\rightarrow$ contacts.id)

amount (numeric)

stage (enum: 'Qualification', 'Needs Analysis', 'Proposal', 'Negotiation', 'Closed Won', 'Closed Lost')

closing_date (date)

created_at (timestamp)

tasks / activities

id (uuid, primary key)

title (text)

due_date (timestamp)

status (enum: 'Pending', 'In Progress', 'Completed')

related_to_type (text: 'Contact', 'Deal', 'Account')

related_to_id (uuid)

4. Key Functional Features

A. Contact & Account Management

List View: Table displaying Name, Account Name, Email, Phone, and Owner with sorting and pagination.

Filter Panel: Filter by system-defined tags (e.g., Touched Records, Untouched Records, Activities) and custom field values.

CRUD Modals: Popup forms to create, edit, or delete contacts and accounts.

B. Deals & Pipeline (Kanban Board)

Visual drag-and-drop Kanban view categorized by deal stages.

Total deal values calculated at the top of each stage column.

Clickable deal cards that open detailed deal view.

C. Activity Tracking

Display upcoming tasks, scheduled meetings, and call logs.

Ability to log notes directly under a Contact or Deal record.

5. UI & Styling Guidelines

Color Palette: Dark slate/navy sidebar (#1e293b / #0f172a), light background for main content (#f8fafc).

Design System: Clean borders, subtle shadows, status badges with soft pill designs (e.g., green for upcoming, orange for today).

Responsiveness: Collapsible sidebar for desktop and mobile navigation drawer.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/809c8dd1-6df3-4eef-9498-5124b7a3cc5f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
###
