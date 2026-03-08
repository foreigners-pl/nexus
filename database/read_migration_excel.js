const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, 'crm_migration_structured.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('Sheet names:', workbook.SheetNames);

// Read Clients sheet
const clientsSheet = workbook.Sheets['Clients'];
const clientsData = XLSX.utils.sheet_to_json(clientsSheet);
console.log('\n=== CLIENTS SHEET ===');
console.log('Total clients:', clientsData.length);
console.log('Columns:', Object.keys(clientsData[0] || {}));
console.log('\nFirst 3 clients:');
clientsData.slice(0, 3).forEach((c, i) => console.log(`Client ${i + 1}:`, JSON.stringify(c, null, 2)));

// Read Cases sheet
const casesSheet = workbook.Sheets['Cases'];
const casesData = XLSX.utils.sheet_to_json(casesSheet);
console.log('\n=== CASES SHEET ===');
console.log('Total cases:', casesData.length);
console.log('Columns:', Object.keys(casesData[0] || {}));
console.log('\nFirst 3 cases:');
casesData.slice(0, 3).forEach((c, i) => console.log(`Case ${i + 1}:`, JSON.stringify(c, null, 2)));

// Get unique values for lookups
console.log('\n=== UNIQUE VALUES FOR MAPPING ===');

const countries = [...new Set(clientsData.map(c => c.country_of_origin).filter(Boolean))];
console.log('\nUnique countries:', countries.length);
console.log(countries.slice(0, 20));

const cities = [...new Set(clientsData.map(c => c.city_poland).filter(Boolean))];
console.log('\nUnique cities:', cities.length);
console.log(cities.slice(0, 20));

const assignees = [...new Set(casesData.map(c => c.assignee).filter(Boolean))];
console.log('\nUnique assignees:', assignees.length);
console.log(assignees);

const sources = [...new Set(casesData.map(c => c.source).filter(Boolean))];
console.log('\nUnique sources:', sources);
