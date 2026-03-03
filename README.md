# AIO Document DB Viewer

A professional web-based management interface for Adobe AIO App Builder document database collections. This tool provides a comprehensive graphical UI over the `aio app db` CLI, making it easy to browse, query, and manage your App Builder databases across multiple environments.

![Professional UI](https://img.shields.io/badge/UI-Modern_SPA-blue)
![Backend](https://img.shields.io/badge/Backend-Node.js_/_Express-green)
![CLI](https://img.shields.io/badge/CLI-Adobe_AIO-orange)

## Features

### 📊 Database Dashboard
- **Connectivity Monitoring:** Real-time ping and status checks.
- **Provisioning Status:** Instant visibility into your database state.
- **Storage Statistics:** View database-wide stats including storage size, index size, and object counts.

### 📁 Collection Management
- **Smart Browser:** Quick access to all collections in your selected environment.
- **Advanced Creation:** Create collections with optional JSON schema validation.
- **Lifecycle Tools:** Rename existing collections or drop them with double-confirmation safety.
- **Detailed Stats:** View per-collection statistics and metadata.

### 🔍 Indexing & Search
- **Index Management:** List, create, and drop database indexes directly from the UI.
- **JSON Filtering:** Rich document querying with JSON filters.
- **`_id` Support:** Integrated client-side `_id` filtering (extending standard CLI capabilities).

### 📦 App State Management
- **Full CLI Support:** Dedicated section for `aio app state` (list, get, put, delete, stats).
- **Inline Value View:** Browse state keys and their current values in a structured table.
- **State Stats:** Monitor state storage size and metadata directly from the UI.
- **Region Awareness:** All state operations automatically use your configured environment.

### 📝 Document Operations
- **Bulk Import:** Insert single documents or arrays of JSON objects.
- **Granular Control:** Delete individual documents or clear entire collections.
- **Document Preview:** Hover-to-expand data viewing for complex nested objects.

### 🌐 Environment Control
- **Multi-Environment Support:** Configure and switch between different AIO projects and regions.
- **Region Awareness:** Full support for `apac`, `amer`, `emea`, and `aus`.
- **Directory Browser:** Built-in file explorer to select project paths with ease.
- **Persistent State:** Remembers your last selected environment and configurations.

### ✨ UI & Performance
- **Lazy Loading:** Main views are only loaded on-demand, improving initial response times.
- **Visual Feedback:** Added loading spinners for all long-running CLI operations.
- **Professional Layout:** Improved sidebar organization with "Collection Stats" and "App State" sections.

## Prerequisites

- [Adobe AIO CLI](https://developer.adobe.com/app-builder/docs/getting_started/first_app/#3-signing-in-from-cli) installed and authenticated (`aio login`)
- An AIO App Builder project with a document database configured
- [Node.js](https://nodejs.org/) >= 18

## Installation

```bash
# Clone the repository
git clone https://github.com/your-username/aio-document-db-viewer.git
cd aio-document-db-viewer

# Install dependencies
npm install
```

## Running the App

```bash
# Start the server (default port 9001)
npm start
```

Open [http://localhost:9001](http://localhost:9001) in your browser.

### Custom Configuration

To use a different port:
```bash
PORT=3000 npm start
```

## Usage

1. **Add Environment:** Click **+ Add Environment** in the sidebar. Use the directory browser to point to your AIO project folder.
2. **Dashboard:** Select an environment to see the database health and statistics.
3. **Explore Collections:** Click any collection in the sidebar to open its management view.
4. **Manage Documents:** Use the **Documents** tab to query, insert, or delete data.
5. **Optimize:** Use the **Indexes** tab to manage performance.
6. **Maintenance:** Use the **Settings** tab to rename or drop collections.

## Technical Notes

- **CLI-First Architecture:** This app acts as a wrapper around `aio app db`. It requires the CLI to be available in your system path.
- **Security:** Ensure you are logged into the AIO CLI on the machine running this server. The server executes commands in the context of the current user.
- **JSON Storage:** Environments are persisted in a local `environments.json` file.

## License

MIT
