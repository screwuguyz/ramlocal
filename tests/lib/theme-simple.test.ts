import { describe, it, expect, beforeEach } from 'vitest';

// Simple test without importing theme.ts (which imports CSS)
describe('Basic Math Test', () => {
  it('should add numbers correctly', () => {
    expect(1 + 1).toBe(2);
  });

  it('should multiply numbers correctly', () => {
    expect(2 * 3).toBe(6);
  });
});

describe('String Operations', () => {
  it('should concatenate strings', () => {
    expect('Hello' + ' ' + 'World').toBe('Hello World');
  });

  it('should check string length', () => {
    expect('test'.length).toBe(4);
  });
});


// Simple test without importing theme.ts (which imports CSS)
describe('Basic Math Test', () => {
  it('should add numbers correctly', () => {
    expect(1 + 1).toBe(2);
  });

  it('should multiply numbers correctly', () => {
    expect(2 * 3).toBe(6);
  });
});

describe('String Operations', () => {
  it('should concatenate strings', () => {
    expect('Hello' + ' ' + 'World').toBe('Hello World');
  });

  it('should check string length', () => {
    expect('test'.length).toBe(4);
  });
});




