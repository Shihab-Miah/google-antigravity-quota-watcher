const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');

function walk(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        const p = path.join(dir, f);
        if (fs.statSync(p).isDirectory()) walk(p, callback);
        else if (p.endsWith('.ts')) callback(p);
    });
}

const mappings = {
    'quotaService': 'quota/quotaService',
    'statusBar': 'ui/statusBar',
    'webviewPanel': 'ui/webviewPanel',
    'configService': 'config/configService',
    'proxyService': 'proxy/proxyService',
    'portDetectionService': 'platform/portDetectionService',
    'processPortDetector': 'platform/processPortDetector',
    'unixProcessDetector': 'platform/unixProcessDetector',
    'windowsProcessDetector': 'platform/windowsProcessDetector',
    'platformDetector': 'platform/platformDetector',
    'safePowerShellPath': 'platform/safePowerShellPath'
};

walksrcDir, file => {
    let content = fs.readFileSync(file, 'utf8');
    let changed = false;
    
    const relToSrc = path.relative(path.dirname(file), srcDir).replace(/\\\/g, '/');
    const prefix = relToSrc === '' ? './' : relToSrc + '/';

    for (const [oldName, newName] of Object.entries(mappings)) {
        const regex = new RegExp(`from\\s+['"](\\.\\/|\\.\\.\\/|\\.\\.\\/\\.\\.\\/)${oldName}['"]`, 'g');
        content = content.replace(regex, (match, p1) => {
            changed = true;
            return `from '${prefix}${newName}'`;
        });
    }

    if (changed) {
        fs.writeFileSync(file, content);
        console.log('Updated', file);
    }
});
