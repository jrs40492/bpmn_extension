
// ... existing code ...
function toDmn13(xml: string): string {
  // Convert DMN 1.2 to 1.3 (which dmn-js supports)
  return convertNamespaces(xml, DMN12_MODEL, DMN12_DMNDI, DMN13_MODEL, DMN13_DMNDI);
}

// Remove or comment out toDmn16 since dmn-js doesn't support 1.6
// function toDmn16(xml: string): string { ... }
// ... existing code ...
