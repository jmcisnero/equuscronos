const { execSync } = require('child_process');

try {
  const output = execSync('netstat -ano').toString();
  const lines = output.split('\n');
  
  console.log("Lines containing 3000:");
  for (const line of lines) {
    if (line.includes('3000')) {
      console.log(line.trim());
    }
  }
} catch (error) {
  console.error('Error:', error.message);
}
