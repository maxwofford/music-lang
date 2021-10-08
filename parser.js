
const oneOf = item => w => w.startsWith(item);
const anyOf = arr => w => arr.some(oneOf(w));

const skip = ["ws"];
const literals = [";", "x", "[", "]"];

const tokenRules = {
  number: /\d+/,
  float: /[+-]?([0-9]*[.])?[0-9]+/,
  property: /[a-z][A-Z]\s*=/,
  letter: /[a-g]#?/,
  length: /\-+|\++/,
  ws: /\s+/,
  literal: anyOf(literals),
}

const regExFunc = regex => string => { // not used
  const match = string.match(regex); 
  return match && match[0] === string;
}

const makeTest = (rule, start = false) => // not used
  rule instanceof RegExp ? regExFunc(rule)
  : typeof rule === "string" ? x => rule.startsWith(x)
  : Array.isArray(rule) ? x => rule.map(makeTest).some(f => f(x))
  : rule; // is function

const makeTokenizer = (rules, { skip = [], literals = [] } = { }) => string => { 
  let index = 0;
  const peek = () => string[index];
  // const next = () => string[index++];
  const tokens = [];

  while (index < string.length) {
    let type, value;

    for (const key in rules) {
      type = key;
      value = null;
      let rule = rules[key];
      if (rule instanceof RegExp) {
        value = string.slice(index).match(rule);

        if (value !== null && value.index === 0) {
          value = value[0];        
          break;
        }
      } else if (typeof rule === "function") {
        if (rule(peek())) {
          let i = index;
          value = string[i]
          while (rule(value)) {
            if(rule(value + string[i + 1])) value += string[++i];
            else break;
          }
          break;
        }
      }
    }

    if (value === undefined || value === null) throw `Unknown character: ${peek()}`
    if (literals.includes(value)) type = value;
    if (!skip.includes(type)) tokens.push({ type, value, index });
    index += value.length;

  }

  return tokens;
}

//////////////////////////////

const convert = pred => s => {
  return s[0] && (s[0].type === pred)
    ? [ s[0], s.slice(1) ] 
    : null
}

// const any = s => s[0] ? [ s[0], s.slice(1) ] : null; // Do I want this?

const many = (pred) => s => {
  if (typeof pred === "string") pred = convert(pred);

  const arr = [];
  let next = pred(s);

  while (next) {
    arr.push(next);
    next = pred(next[1]);
  }

  return arr.length > 0 
    ? [ arr.map(([x]) => x), arr[arr.length - 1][1] ] 
    : [[], s];
}

const or = (preds, transform = null) => s => {
    const result = preds.reduce((acc, cur) => 
        acc || (typeof cur === "string" ? convert(cur) : cur)(s)
      , false);

    return Array.isArray(result) 
      ? (transform ? [ transform(result[0]), result[1] ] : result)
      : null;
}

const and = (preds, transform = null) => s => { // must match each predicate
  const result = [];
  for (let pred of preds) {
    if (typeof pred === "string") pred = convert(pred);

    const next = pred(s);
    if (next === null) return null;
    s = next[1];
    result.push(next[0])
  }
  
  return result.length === preds.length 
    ? [transform ? transform(result) : result, s] 
    : null;
}

const trim = pred => or([ // not used
  and(["ws", pred, "ws"], ([_0, x, _1]) => x),
  and([pred, "ws"], ([x, _]) => x),
  and(["ws", pred], ([_, x]) => x),
  pred
])

const none = () => s => [ null, s ]; // not used

const any = () => s => [ s[0], s.slice(1) ]; // not used

const optionalWs = s => or([ // not used
  "ws",
  none
])(s);

const joined = (preds, transform = null) => s => { // must match each predicate
  const result = [];

  let startIndex = null;
  for (let pred of preds) {
    if (typeof pred === "string") pred = convert(pred);

    const next = pred(s);
    if (next === null) return null;
    s = next[1];

    if (startIndex !== null) {
      if (next[0].index !== startIndex) return null;
    }
    startIndex = next[0].index + next[0].value.length;

    result.push(next[0])
  }
  
  return result.length === preds.length 
    ? [transform ? transform(result) : result, s] 
    : null;
}

///////////////////

class Stream { // not used
  constructor(ast) {
    this.index = 0;
    this.ast = ast;
  }

  peek() {
    return this.ast[this.index];
  }

  next() {
    const current = this.ast[this.index];
    this.index++;
    return current;
  }

  eof() {
    return this.peek() === undefined;
  }
}

//////////////////////////////




const tokenize = makeTokenizer(tokenRules, { skip, literals });


const convertNote = x => {
  if (Array.isArray(x)) {
    const note = { type: "note", letter: x[0].value, number: Number(x[1].value)};
    return note;
  }

  return { type: "note", letter: x.value, number: 0 };
}


const note = or([
  joined(["letter", "number"]),
  "letter",
  ";"
], convertNote);

const convertSet = x => {
  if (Array.isArray(x)) {
    return { type: "set", val: x[1] };
  }

  return x;
}

const convertGroup = x => {
  if (Array.isArray(x)) {
    return { type: "group", val: x[1] };
  }

  return x
}

const set = s => or([
  and(["[", beats, "]"], convertGroup),
  note
], convertSet)(s)

const convertLength = x => Array.isArray(x)
  ? { type: "length", note: x[0], length: x[1].value.length, plusOrMinus: x[1].value[0] }
  : x;

const beat = or([
  and([note, "length"], convertLength),
  note,
  and([set, "length"], convertLength),
  set,
])

const beats = many(beat);

const convertRepeat = x => Array.isArray(x) 
  ? { type: "repeat", number: x[0].value, beats: x[2] }
  : x;

const repeat = s => and([
  "number", 
  "x",
  beats
], convertRepeat)(s)

const setProperty = s => and([
  "property",
  or(["float", "number"]),
])(s)

const parse = or([repeat, setProperty, beats]);

export { parse, tokenize };








