const express = require('express');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// --- Simple JSON file store for environments ---
const STORE_PATH = path.join(__dirname, 'environments.json');

function loadStore() {
  if (!fs.existsSync(STORE_PATH)) return { nextId: 1, environments: [] };
  return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
}

function saveStore(store) {
  fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

function getEnv(envId) {
  const store = loadStore();
  const envRaw = store.environments.find(e => e.id === Number(envId));
  if (!envRaw) throw new Error('Environment not found');
  
  // Create a copy to avoid mutating the store in-memory
  const env = { ...envRaw };
  return env;
}

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// --- Environment CRUD ---

app.get('/api/environments', (req, res) => {
  const store = loadStore();
  res.json(store.environments);
});

app.post('/api/environments', (req, res) => {
  const { name, project_dir, region } = req.body;
  if (!name || !project_dir || !region) {
    return res.status(400).json({ error: 'name, project_dir, and region are required' });
  }
  const store = loadStore();
  if (store.environments.some(e => e.name === name)) {
    return res.status(400).json({ error: 'An environment with that name already exists' });
  }
  const env = { id: store.nextId++, name, project_dir, region };
  store.environments.push(env);
  saveStore(store);
  res.json(env);
});

app.put('/api/environments/:id', (req, res) => {
  const { name, project_dir, region } = req.body;
  const store = loadStore();
  const index = store.environments.findIndex(e => e.id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'Environment not found' });
  
  store.environments[index] = { 
    ...store.environments[index], 
    name: name || store.environments[index].name,
    project_dir: project_dir || store.environments[index].project_dir,
    region: region || store.environments[index].region
  };
  
  saveStore(store);
  res.json(store.environments[index]);
});

app.delete('/api/environments/:id', (req, res) => {
  const store = loadStore();
  store.environments = store.environments.filter(e => e.id !== Number(req.params.id));
  saveStore(store);
  res.json({ success: true });
});

// --- Directory Browser ---

app.get('/api/browse', (req, res) => {
  const dir = req.query.path || '/';
  try {
    const resolved = path.resolve(dir);
    const entries = fs.readdirSync(resolved, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .map(e => ({ name: e.name, path: path.join(resolved, e.name) }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json({ current: resolved, parent: path.dirname(resolved), dirs });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Collections & Documents ---

app.get('/api/db-status', (req, res) => {
  const envId = req.query.envId;
  if (!envId) return res.status(400).json({ error: 'envId is required' });

  try {
    const env = getEnv(envId);
    const output = execSync(`aio app db status --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/db-ping', (req, res) => {
  const envId = req.query.envId;
  if (!envId) return res.status(400).json({ error: 'envId is required' });

  try {
    const env = getEnv(envId);
    const output = execSync(`aio app db ping --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/db-stats', (req, res) => {
  const envId = req.query.envId;
  const scale = req.query.scale || '1';
  if (!envId) return res.status(400).json({ error: 'envId is required' });

  try {
    const env = getEnv(envId);
    const output = execSync(`aio app db stats --scale ${scale} --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    // Parsing table-like output if it's not JSON
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/collections', (req, res) => {
  const envId = req.query.envId;
  if (!envId) return res.status(400).json({ error: 'envId is required' });

  try {
    const env = getEnv(envId);
    const output = execSync(`aio app db collection list --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });

    const names = [];
    for (const line of output.split('\n')) {
      const match = line.match(/│\s+(\S+)\s+│/);
      if (match && match[1] !== 'name') {
        names.push(match[1]);
      }
    }

    res.json(names);
  } catch (err) {
    console.error('Error listing collections:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/collections', (req, res) => {
  const { envId, name, validator } = req.body;
  if (!envId || !name) return res.status(400).json({ error: 'envId and name are required' });

  try {
    const env = getEnv(envId);
    let cmd = `aio app db collection create ${name} --region ${env.region}`;
    if (validator) {
      cmd += ` --validator '${JSON.stringify(validator)}'`;
    }
    const output = execSync(cmd, { cwd: env.project_dir, encoding: 'utf8', timeout: 30000 });
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/collections/rename', (req, res) => {
  const { envId, oldName, newName } = req.body;
  if (!envId || !oldName || !newName) return res.status(400).json({ error: 'envId, oldName, and newName are required' });

  try {
    const env = getEnv(envId);
    const output = execSync(`aio app db collection rename ${oldName} ${newName} --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/collections/stats', (req, res) => {
  const { envId, collection } = req.query;
  if (!envId || !collection) return res.status(400).json({ error: 'envId and collection are required' });

  try {
    const env = getEnv(envId);
    const output = execSync(`aio app db collection stats ${collection} --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/indexes', (req, res) => {
  const { envId, collection } = req.query;
  if (!envId || !collection) return res.status(400).json({ error: 'envId and collection are required' });

  try {
    const env = getEnv(envId);
    const output = execSync(`aio app db index list ${collection} --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/indexes', (req, res) => {
  const { envId, collection, fields, spec } = req.body;
  if (!envId || !collection) return res.status(400).json({ error: 'envId and collection are required' });

  try {
    const env = getEnv(envId);
    let cmd = `aio app db index create ${collection} --region ${env.region}`;
    if (spec) {
      cmd += ` -s '${JSON.stringify(spec)}'`;
    } else if (fields && Array.isArray(fields)) {
      fields.forEach(f => { cmd += ` -k ${f}`; });
    }
    const output = execSync(cmd, { cwd: env.project_dir, encoding: 'utf8', timeout: 30000 });
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/indexes', (req, res) => {
  const { envId, collection, indexName } = req.query;
  if (!envId || !collection || !indexName) return res.status(400).json({ error: 'envId, collection, and indexName are required' });

  try {
    const env = getEnv(envId);
    const output = execSync(`aio app db index drop ${collection} ${indexName} --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents/insert', (req, res) => {
  const { envId, collection, documents } = req.body;
  if (!envId || !collection || !documents) return res.status(400).json({ error: 'envId, collection, and documents are required' });

  try {
    const env = getEnv(envId);
    const docsStr = JSON.stringify(documents);
    const output = execSync(`aio app db document insert "${collection}" '${docsStr}' --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/documents/count', (req, res) => {
  const { envId, collection, filter } = req.query;
  if (!envId || !collection) return res.status(400).json({ error: 'envId and collection are required' });

  try {
    const env = getEnv(envId);
    const filterStr = filter || '{}';
    const output = execSync(`aio app db document count "${collection}" '${filterStr}' --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/documents', (req, res) => {
  const { envId, collection, filter } = req.body;
  if (!envId || !collection) {
    return res.status(400).json({ error: 'envId and collection are required' });
  }

  const filterStr = filter || '{}';

  try {
    const env = getEnv(envId);
    let filterObj = {};
    try { filterObj = JSON.parse(filterStr); } catch (e) {}

    // Separate _id from other filter fields (aio CLI doesn't support _id filtering)
    const idFilter = filterObj._id || null;
    const cliFilter = { ...filterObj };
    delete cliFilter._id;
    const cliFilterStr = JSON.stringify(cliFilter);

    const output = execSync(
      `aio app db document find "${collection}" '${Object.keys(cliFilter).length ? cliFilterStr : '{}'}' --region ${env.region}`,
      { cwd: env.project_dir, encoding: 'utf8', timeout: 30000 }
    );

    const startIdx = output.indexOf('[');
    const endIdx = output.lastIndexOf(']');
    if (startIdx === -1 || endIdx === -1) {
      return res.json([]);
    }

    let docs = JSON.parse(output.substring(startIdx, endIdx + 1));

    // Apply _id filter client-side
    if (idFilter) {
      docs = docs.filter(d => d._id === idFilter);
    }

    res.json(docs);
  } catch (err) {
    console.error('Error finding documents:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/delete-all', (req, res) => {
  const { envId, collection } = req.body;
  if (!envId || !collection) {
    return res.status(400).json({ error: 'envId and collection are required' });
  }

  try {
    const env = getEnv(envId);
    let deleted = 0;

    // aio delete only removes one doc per call, so loop until empty
    while (true) {
      const output = execSync(
        `aio app db document delete "${collection}" '{}' --region ${env.region}`,
        { cwd: env.project_dir, encoding: 'utf8', timeout: 30000 }
      );
      if (output.includes('No document found')) break;
      deleted++;
    }

    console.log(`Deleted ${deleted} documents from ${collection}`);
    res.json({ success: true, deleted });
  } catch (err) {
    console.error('Error deleting all documents:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/delete-one', (req, res) => {
  const { envId, collection, doc } = req.body;
  if (!envId || !collection || !doc) {
    return res.status(400).json({ error: 'envId, collection, and doc are required' });
  }

  try {
    const env = getEnv(envId);
    // Build filter from non-_id fields since _id cannot be used as a filter
    const filter = {};
    for (const [key, val] of Object.entries(doc)) {
      if (key === '_id') continue;
      if (val !== null && typeof val !== 'object') {
        filter[key] = val;
      }
    }
    const filterStr = JSON.stringify(filter);
    console.log(`Deleting from ${collection} with filter: ${filterStr}`);
    const output = execSync(
      `aio app db document delete "${collection}" '${filterStr}' --region ${env.region}`,
      { cwd: env.project_dir, encoding: 'utf8', timeout: 30000 }
    );
    console.log('Delete one output:', output);
    res.json({ success: true, output });
  } catch (err) {
    console.error('Error deleting document:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/drop-collection', (req, res) => {
  const { envId, collection } = req.body;
  if (!envId || !collection) {
    return res.status(400).json({ error: 'envId and collection are required' });
  }

  try {
    const env = getEnv(envId);
    const output = execSync(
      `aio app db collection drop ${collection} --region ${env.region}`,
      { cwd: env.project_dir, encoding: 'utf8', timeout: 30000 }
    );
    console.log(`Dropped collection ${collection}:`, output);
    res.json({ success: true, output });
  } catch (err) {
    console.error('Error dropping collection:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// --- App State ---

app.get('/api/state/list', (req, res) => {
  const { envId } = req.query;
  if (!envId) return res.status(400).json({ error: 'envId is required' });

  try {
    const env = getEnv(envId);
    const output = execSync(`aio app state list --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    
    // Improved parsing: handle both table-like and plain newline-separated output
    const keys = [];
    const lines = output.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // If it's a table-like output with │ borders
      const match = trimmed.match(/│\s+(\S+)\s+│/);
      if (match) {
        if (match[1] !== 'key') {
          keys.push(match[1]);
        }
      } else if (!trimmed.startsWith('─') && !trimmed.toLowerCase().startsWith('key')) {
        // Fallback for plain list output: split by whitespace and take first part
        const parts = trimmed.split(/\s+/);
        if (parts[0]) keys.push(parts[0]);
      }
    }

    // Fetch values for each key to show in the list
    const results = keys.map(key => {
      try {
        const val = execSync(`aio app state get ${key} --region ${env.region}`, {
          cwd: env.project_dir,
          encoding: 'utf8',
          timeout: 10000,
        });
        return { key, value: val.trim() };
      } catch (e) {
        return { key, value: '[Error fetching value]' };
      }
    });

    res.json(results);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/state/get', (req, res) => {
  const { envId, key } = req.query;
  if (!envId || !key) return res.status(400).json({ error: 'envId and key are required' });

  try {
    const env = getEnv(envId);
    const output = execSync(`aio app state get ${key} --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    res.json({ value: output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/state/put', (req, res) => {
  const { envId, key, value } = req.body;
  if (!envId || !key) return res.status(400).json({ error: 'envId and key are required' });

  try {
    const env = getEnv(envId);
    const output = execSync(`aio app state put ${key} '${value}' --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/state/delete', (req, res) => {
  const { envId, keys } = req.query;
  if (!envId || !keys) return res.status(400).json({ error: 'envId and keys are required' });

  try {
    const env = getEnv(envId);
    const output = execSync(`aio app state delete ${keys} --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/state/stats', (req, res) => {
  const { envId } = req.query;
  if (!envId) return res.status(400).json({ error: 'envId is required' });

  try {
    const env = getEnv(envId);
    const output = execSync(`aio app state stats --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    res.json({ output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/db-delete', (req, res) => {
  const { envId } = req.body;
  if (!envId) return res.status(400).json({ error: 'envId is required' });

  try {
    const env = getEnv(envId);
    const output = execSync(`aio app db delete --region ${env.region}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/api-mesh/log-list', (req, res) => {
  const { envId } = req.query;
  if (!envId) return res.status(400).json({ error: 'envId is required' });

  try {
    const env = getEnv(envId);
    const output = execSync('aio api-mesh:log-list', {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });

    const logs = [];
    const lines = output.split('\n');
    let headerFound = false;
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('───')) {
        if (trimmed.startsWith('───')) headerFound = true;
        continue;
      }
      
      // Skip selection info
      if (trimmed.startsWith('Selected organization:') || 
          trimmed.startsWith('Selected project:') || 
          trimmed.startsWith('Select workspace:')) continue;

      if (trimmed.toLowerCase().includes('ray id') && trimmed.toLowerCase().includes('timestamp')) {
        headerFound = true;
        continue;
      }
      
      if (headerFound) {
        // Ray ID, Timestamp, Status, Level
        // Split by any whitespace and filter out empty strings
        const parts = trimmed.split(/\s+/).filter(p => p.length > 0);
        if (parts.length >= 4) {
          logs.push({
            rayId: parts[0],
            timestamp: parts[1],
            status: parts[2],
            level: parts[3]
          });
        }
      }
    }
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/api-mesh/log-get', (req, res) => {
  const { envId, rayId } = req.query;
  if (!envId || !rayId) return res.status(400).json({ error: 'envId and rayId are required' });

  try {
    const env = getEnv(envId);
    const output = execSync(`aio api-mesh log-get ${rayId}`, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    
    // Strip selection info from the beginning
    const lines = output.split('\n').filter(line => {
      const t = line.trim();
      return !t.startsWith('Selected organization:') && 
             !t.startsWith('Selected project:') && 
             !t.startsWith('Select workspace:');
    });
    
    res.json({ output: lines.join('\n').trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/api-mesh/log-bulk', (req, res) => {
  const { envId, startTime, endTime, filename } = req.body;
  if (!envId || !startTime || !endTime || !filename) {
    return res.status(400).json({ error: 'envId, startTime, endTime, and filename are required' });
  }

  try {
    const env = getEnv(envId);
    const cmd = `echo "y" | aio api-mesh log-get-bulk --startTime ${startTime} --endTime ${endTime} --filename ${filename}`;
    const output = execSync(cmd, {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 60000, // Bulk might take longer
    });
    res.json({ success: true, output });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/api-mesh/describe', (req, res) => {
  const { envId } = req.query;
  if (!envId) return res.status(400).json({ error: 'envId is required' });

  try {
    const env = getEnv(envId);
    const output = execSync('aio api-mesh:describe', {
      cwd: env.project_dir,
      encoding: 'utf8',
      timeout: 30000,
    });
    
    // Strip selection info
    const lines = output.split('\n').filter(line => {
      const t = line.trim();
      return !t.startsWith('Selected organization:') && 
             !t.startsWith('Selected project:') && 
             !t.startsWith('Select workspace:');
    });
    
    res.json({ output: lines.join('\n').trim() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 9001;
app.listen(PORT, () => {
  console.log(`Doc DB Viewer running at http://localhost:${PORT}`);
});
