/**
 * Polyfill String.prototype.includes and startsWith with pure-JS implementations.
 * Hermes on iOS 26 has a write-fault bug in its native stringPrototypeIncludesOrStartsWith
 * C++ implementation. By replacing these methods before any other module runs, the
 * buggy native code path is never invoked.
 */
String.prototype.includes = function (search, start) {
  if (typeof start !== 'number' || start < 0) start = 0;
  return this.indexOf(search, start) !== -1;
};

String.prototype.startsWith = function (search, start) {
  var s = String(search);
  var pos = typeof start === 'number' ? Math.max(0, start) : 0;
  return this.slice(pos, pos + s.length) === s;
};

require('expo-router/entry');
