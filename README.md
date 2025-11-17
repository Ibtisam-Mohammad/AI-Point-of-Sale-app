# VentiPOS

> A smart, voice-driven Point of Sale app that converts spoken orders into structured, itemized lists.

This project is an Angular-based Point of Sale (POS) system that leverages the Google Gemini API for voice recognition to process customer orders. It features inventory management, order history, sales analytics, and customer management.

## Features

-   **Voice-driven Order Taking**: Speak an order, and the app transcribes it into an itemized list.
-   **Inventory Management**: Add, edit, and delete products and their variants. Update stock levels manually or by scanning receipts.
-   **AI-Powered Stock Updates**: Upload an image of a receipt, and Gemini will parse it to update your inventory.
-   **Order History**: Review past transactions.
-   **Sales Analytics**: Visualize sales data with charts and key metrics.
-   **Customer Management**: Keep track of customer purchase history.

## Running Locally

This project is designed to run in a web-based development environment that provides necessary dependencies and environment variables. To run it on your local machine, you'll need to serve the files with a local web server and provide your own Google Gemini API key.

### Prerequisites

1.  A modern web browser (like Chrome, Firefox, or Edge).
2.  A local web server. If you have Python 3 installed, you can use its built-in server.

### Setup Instructions

1.  **Download the Files**: Download all the project files and place them in a single directory on your computer.

2.  **Provide your Gemini API Key**:
    The application needs a Google Gemini API key to function.
    -   Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
    -   Open the file `src/services/gemini.service.ts`.
    -   Find this line (around line 34):
        ```typescript
        this.ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        ```
    -   Replace `process.env.API_KEY` with your actual API key as a string:
        ```typescript
        this.ai = new GoogleGenAI({ apiKey: 'YOUR_API_KEY_HERE' });
        ```
    -   **Important**: Remember to save the file. Do not commit your API key to a public repository.

3.  **Start a Local Web Server**:
    -   Open your terminal or command prompt.
    -   Navigate to the root directory where you saved the project files (the one containing `index.html`).
    -   If you have Python 3, run the following command:
        ```bash
        python -m http.server
        ```
        If you have Python 2, use:
        ```bash
        python -m SimpleHTTPServer
        ```
    -   This will start a web server, usually on port 8000. Your terminal will show a message like `Serving HTTP on 0.0.0.0 port 8000 (http://0.0.0.0:8000/) ...`.

4.  **Open the Application**:
    -   Open your web browser and go to `http://localhost:8000`.
    -   The VentiPOS application should now be running.

> **Note**: Because this application is designed for a zoneless Angular environment and uses browser-native modules via an import map, no `npm install` or build step is required.
