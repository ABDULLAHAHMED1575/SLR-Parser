export const parseProductionRules = (input) => {
    if (!input.trim()) throw new Error("Input cannot be empty.");

    const lines = input.trim().split('\n');
    const parsedRules = [];
    const grammar = {};
    
    // Handle augmented start symbol
    const firstLHS = lines[0].split('->')[0].trim();
    const startSymbol = `${firstLHS}'`;
    
    parsedRules.push({
        nonTerminal: startSymbol,
        productions: [[firstLHS]],
        isAugmentedStart: true,
        itemWithDot: ['.', firstLHS]
    });

    lines.forEach(line => {
        // Split on -> but handle empty right hand side
        const parts = line.split('->');
        const lhs = parts[0].trim();
        const rhs = parts[1] ? parts[1].trim() : '';

        // Initialize grammar entry for this non-terminal if not exists
        if (!grammar[lhs]) grammar[lhs] = [];

        if (!rhs) {
            // Handle empty production (epsilon)
            grammar[lhs].push(['ε']);
            parsedRules.push({
                nonTerminal: lhs,
                productions: [['ε']],
                itemWithDot: ['.']
            });
        } else {
            // Handle normal productions with alternatives
            const productions = rhs.split('|').map(prod => {
                const tokens = prod.trim().split(/\s+/);
                return tokens;
            });

            productions.forEach(prod => {
                grammar[lhs].push(prod);
                parsedRules.push({
                    nonTerminal: lhs,
                    productions: [prod],
                    itemWithDot: ['.', ...prod]
                });
            });
        }
    });

    return { parsedRules, grammar, startSymbol };
};

const findClosure = (parsedRules, grammar) => {
    if (!parsedRules || !parsedRules[0]) return [];

    const isRuleEqual = (rule1, rule2) => JSON.stringify(rule1) === JSON.stringify(rule2);
    const createNewRule = (symbol, production) => ({
        nonTerminal: symbol,
        production: production,
        itemWithDot: ['.', ...production]
    });

    let currentSet = parsedRules.map(rule => ({
        nonTerminal: rule.nonTerminal,
        production: rule.productions[0],
        itemWithDot: rule.itemWithDot || ['.', ...rule.productions[0]]
    }));

    let setChanged = true;
    while (setChanged) {
        setChanged = false;
        const rulesToAdd = [];

        for (const item of currentSet) {
            const dotIndex = item.itemWithDot.indexOf('.');
            if (dotIndex < item.itemWithDot.length - 1) {
                const nextSymbol = item.itemWithDot[dotIndex + 1];
                if (grammar[nextSymbol]) {
                    for (const production of grammar[nextSymbol]) {
                        const newRule = createNewRule(nextSymbol, production);
                        const existsInCurrent = currentSet.some(r => isRuleEqual(r, newRule));
                        const existsInNew = rulesToAdd.some(r => isRuleEqual(r, newRule));
                        
                        if (!existsInCurrent && !existsInNew) {
                            rulesToAdd.push(newRule);
                            setChanged = true;
                        }
                    }
                }
            }
        }
        currentSet = [...currentSet, ...rulesToAdd];
    }

    return currentSet;
};

const goto = (state, symbol, grammar) => {
    const nextState = state
        .filter(item => {
            const dotIndex = item.itemWithDot.indexOf('.');
            return dotIndex < item.itemWithDot.length - 1 && 
                   item.itemWithDot[dotIndex + 1] === symbol;
        })
        .map(item => {
            const itemWithDot = [...item.itemWithDot];
            const dotIndex = itemWithDot.indexOf('.');
            [itemWithDot[dotIndex], itemWithDot[dotIndex + 1]] = 
            [itemWithDot[dotIndex + 1], itemWithDot[dotIndex]];
            return { ...item, itemWithDot };
        });

    if (nextState.length === 0) return null;

    return findClosure(nextState.map(item => ({
        nonTerminal: item.nonTerminal,
        productions: [item.production],
        itemWithDot: item.itemWithDot
    })), grammar);
};

export const generateStates = (parsedRules, grammar) => {
    const states = new Map();
    const stateQueue = [findClosure([parsedRules.find(rule => rule.isAugmentedStart)], grammar)];
    const processedStates = new Set();

    while (stateQueue.length > 0) {
        const currentState = stateQueue.shift();
        const stateKey = JSON.stringify(currentState);
        
        if (processedStates.has(stateKey)) continue;
        processedStates.add(stateKey);

        const symbolsAfterDot = new Set();
        currentState.forEach(item => {
            const dotIndex = item.itemWithDot.indexOf('.');
            if (dotIndex < item.itemWithDot.length - 1) {
                symbolsAfterDot.add(item.itemWithDot[dotIndex + 1]);
            }
        });

        const transitions = {};
        symbolsAfterDot.forEach(symbol => {
            const nextState = goto(currentState, symbol, grammar);
            if (nextState) {
                transitions[symbol] = nextState;
                if (!processedStates.has(JSON.stringify(nextState))) {
                    stateQueue.push(nextState);
                }
            }
        });

        states.set(states.size, { items: currentState, transitions });
    }

    return Array.from(states.values());
};

export const printStates = (states) => 
    states.map((state, index) => {
        const items = state.items
            .map(item => `${item.nonTerminal} -> ${item.itemWithDot.join(' ')}`)
            .join('\n');

        const transitions = Object.entries(state.transitions)
            .map(([symbol, targetState]) => 
                `Transition on ${symbol}:\n${targetState
                    .map(item => `${item.nonTerminal} -> ${item.itemWithDot.join(' ')}`)
                    .join('\n')}`
            )
            .join('\n\n');

        return `State ${index}:\n${items}\n\nTransitions:\n${transitions}\n\n`;
    }).join('---\n');


export const extractSymbols = (parsedRules) => {
    const nonTerminals = new Set();
    const terminals = new Set();
    
    parsedRules.forEach(rule => {
        nonTerminals.add(rule.nonTerminal);
    });

    parsedRules.forEach(rule => {
        rule.productions[0].forEach(symbol => {
            if (!nonTerminals.has(symbol)) {
                terminals.add(symbol);
            }
        });
    });

    terminals.delete(parsedRules[0].nonTerminal);
    
    return {
        terminals: Array.from(terminals),
        nonTerminals: Array.from(nonTerminals)
    };
};
      
export const createParseTable = (states, terminals, nonTerminals, parsedRules, startSymbol, grammar) => {
    const ACTION = computeActionTable(states, terminals, parsedRules, startSymbol, grammar);
    const GOTO = computeGotoTable(states, nonTerminals);

    return {
        columns: [...terminals, '$', ...nonTerminals],
        rows: states.map((_, i) => {
            return [...terminals, '$'].map(t => ACTION[i][t])
                .concat(nonTerminals.map(nt => GOTO[i][nt] || ''));
        })
    };
};
    
const computeActionTable = (states, terminals, parsedRules, startSymbol, grammar) => {
    const ACTION = {};
    states.forEach((_, i) => {
        ACTION[i] = {};
        terminals.forEach(t => ACTION[i][t] = '');
        ACTION[i]['$'] = '';
    });

    states.forEach((state, i) => {
        state.items.forEach(item => {
            const dotIndex = item.itemWithDot.indexOf('.');
            
            if (dotIndex < item.itemWithDot.length - 1) {
                const symbol = item.itemWithDot[dotIndex + 1];
                if (state.transitions[symbol] && terminals.includes(symbol)) {
                    const nextState = states.findIndex(s => 
                        JSON.stringify(s.items) === JSON.stringify(state.transitions[symbol])
                    );
                    ACTION[i][symbol] = `s${nextState}`;
                }
            }
            else if (dotIndex === item.itemWithDot.length - 1) {
                if (item.nonTerminal === startSymbol && item.production[0] === parsedRules[1].nonTerminal) {
                    ACTION[i]['$'] = 'acc';
                } else {
                    const follow = computeFollow(item.nonTerminal, grammar, parsedRules, startSymbol);
                    const ruleIndex = parsedRules.findIndex(r => 
                        r.nonTerminal === item.nonTerminal && 
                        JSON.stringify(r.productions[0]) === JSON.stringify(item.production)
                    );
                    
                    follow.add('$');
                    follow.forEach(symbol => {
                        if (!ACTION[i][symbol] || ACTION[i][symbol].startsWith('r')) {
                            ACTION[i][symbol] = `r${ruleIndex}`;
                        }
                    });
                }
            }
        });
    });

    return ACTION;
};

const computeGotoTable = (states, nonTerminals) => {
    const GOTO = {};
    
    states.forEach((state, i) => {
        GOTO[i] = {};
        nonTerminals.forEach(nt => GOTO[i][nt] = '');
        
        state.items.forEach(item => {
            const dotIndex = item.itemWithDot.indexOf('.');
            if (dotIndex < item.itemWithDot.length - 1) {
                const symbol = item.itemWithDot[dotIndex + 1];
                if (state.transitions[symbol] && nonTerminals.includes(symbol)) {
                    const nextState = states.findIndex(s => 
                        JSON.stringify(s.items) === JSON.stringify(state.transitions[symbol])
                    );
                    GOTO[i][symbol] = nextState;
                }
            }
        });
    });

    return GOTO;
};
    
const computeFirst = (symbol, grammar, memo = new Map(), visitedSet = new Set()) => {
    if (visitedSet.has(symbol)) return new Set();
    if (memo.has(symbol)) return memo.get(symbol);
    const first = new Set();
    
    visitedSet.add(symbol);

    if (!grammar[symbol]) {
        first.add(symbol);
        return first;
    }

    grammar[symbol].forEach(production => {
        if (production.length === 0 || production[0] === '') {
            first.add('');
        } else {
            const firstSymbol = production[0];
            const firstSet = computeFirst(firstSymbol, grammar, memo, visitedSet);
            firstSet.forEach(s => first.add(s));
        }
    });

    visitedSet.delete(symbol);
    memo.set(symbol, first);
    return first;
};
    
const computeFollow = (nonTerminal, grammar, parsedRules, startSymbol, memo = new Map(), processing = new Set()) => {
    if (processing.has(nonTerminal)) return new Set();
    if (memo.has(nonTerminal)) return memo.get(nonTerminal);

    processing.add(nonTerminal);
    const follow = new Set();
    if (nonTerminal === startSymbol) {
        follow.add('$');
    }

    parsedRules.forEach(rule => {
        rule.productions[0].forEach((symbol, index) => {
            if (symbol === nonTerminal) {
                if (index === rule.productions[0].length - 1) {
                    if (rule.nonTerminal !== nonTerminal) {
                        const parentFollow = computeFollow(rule.nonTerminal, grammar, parsedRules, startSymbol, memo, processing);
                        parentFollow.forEach(f => follow.add(f));
                    }
                } else {
                    const nextSymbol = rule.productions[0][index + 1];
                    const firstOfNext = computeFirst(nextSymbol, grammar);
                    firstOfNext.forEach(f => {
                        if (f !== '') follow.add(f);
                    });
                    if (firstOfNext.has('') && rule.nonTerminal !== nonTerminal) {
                        const parentFollow = computeFollow(rule.nonTerminal, grammar, parsedRules, startSymbol, memo, processing);
                        parentFollow.forEach(f => follow.add(f));
                    }
                }
            }
        });
    });

    processing.delete(nonTerminal);
    memo.set(nonTerminal, follow);
    return follow;
};