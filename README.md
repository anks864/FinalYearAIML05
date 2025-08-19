# INVENTRA – Inventory Management System  

A lightweight **inventory management system** built as part of our final year AIML project.  
The system supports **stock control, order tracking, receipts, transfers, adjustments, low-stock alerts, and financial reporting** – everything needed to manage warehouse and store inventory efficiently.  

---

## 📌 Features  

- **Product Management** – Add new products with SKU, category, unit of measure, and description.  
- **Stock Updates** – Adjust inventory levels manually with audit logging.  
- **Order Management** – Create sales orders with automatic stock deduction.  
- **Goods Receipts** – Record incoming items against purchase orders.  
- **Transfers** – Move stock between warehouses/stores.  
- **Adjustments** – Handle damaged or expired stock with admin validation.  
- **Alerts** – Low-stock alerts with acknowledgment.  
- **Reports** –  
  - Current stock levels (CSV export)  
  - Inventory turnover calculation  
  - Financial records (purchases, returns, COGS)  

---

## 🏗️ System Design  

- **User Stories** – Captured warehouse, sales, purchasing, and finance requirements.  
- **Agile Approach** – Product backlog & sprint backlog with use cases.  
- **Analysis Classes** – Entity, boundary, and control classes identified with CRC cards.  
- **Architecture** – Modular structure for extensibility.  

![System Architecture](./Inventra_System_Architecture.png)  

---

## 💻 Tech Stack  

- **Frontend:** React + TypeScript  
- **UI Components:** shadcn/ui, TailwindCSS  
- **Icons:** lucide-react  
- **State Management:** React useReducer + localStorage persistence  
- **Build Tool:** Vite (default for React + TS projects)  

---

## 🚀 Getting Started  

1. **Clone the repository**  
   ```bash
   git clone https://github.com/anks864/FinalYearAIML05.git
   cd FinalYearAIML05
