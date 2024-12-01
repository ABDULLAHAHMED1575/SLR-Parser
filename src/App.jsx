import React, {
  useCallback,
   useState } from 'react';
import { createParseTable, extractSymbols, generateStates, parseProductionRules } from './Grammar';
import ReactFlow, { 
  Background, 
  Controls, 
  MarkerType,
  useNodesState,
  useEdgesState
} from 'reactflow';
import 'reactflow/dist/style.css';

export default function SLRApp() {
    const [input, setInput] = useState('');
    const [tableData, setTableData] = useState(null);
    const [error, setError] = useState(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [state, setState] = useState([]);
    const [selectedState, setSelectedState] = useState(null);
    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges,setEdges,onEdgesChange] = useEdgesState([]);

    const prepareFlowData = (states, transition) => {
      const nodes = states.map((state, index) => ({
        id: `state${index}`,
        type: 'default',
        data: {
          label: (
            <div className="text-xs">
              <div className="font-bold border-b border-gray-300 pb-1 mb-1">
                State {index}
              </div>
              <div className="text-left">
                {state.items.map((item, i) => (
                  <div key={i} className="whitespace-nowrap">
                    {`${item.nonTerminal} → ${item.itemWithDot.join(' ')}`}
                  </div>
                ))}
              </div>
            </div>
          ),
          items: state.items
        },
        position: {
          x: Math.cos(index * 2 * Math.PI / states.length) * 500 + 300,
          y: Math.sin(index * 2 * Math.PI / states.length) * 200 + 300,
        },
        style: {
          background: "#fff",
          border: '2px solid #4da6ff',
          borderRadius: '8px',
          padding: '10px',
          width: 'auto',
          minWidth: 200,
          fontSize: '11px',
          fontFamily: 'monospace'
        }
      }));
    
      const edges = transition.map(({from, to, label}) => ({
        id: `edge-${from}-${to}`,
        source: `state${from}`,
        target: `state${to}`,
        label,
        type: 'smoothstep',
        markerEnd: {
          type: MarkerType.Arrow
        },
        style: {
          stroke: '#80ffdf'
        },
      }));
    
      return {nodes, edges};
    };
  
    const handleParse = async () => {
        try {
          setIsProcessing(true);
          setError(null);

          const { parsedRules, grammar, startSymbol } = parseProductionRules(input);
          
          const generatedstates = generateStates(parsedRules, grammar);
          
          const { terminals, nonTerminals } = extractSymbols(parsedRules);
          const table = createParseTable(generatedstates, terminals, nonTerminals, parsedRules, startSymbol, grammar);
          
          setState(generatedstates);
          setTableData(table);

          const transitions = [];
          generatedstates.forEach((state, fromIndex) => {
            Object.entries(state.transitions).forEach(([symbol, targetState]) => {
              const toIndex = generatedstates.findIndex(s => 
                JSON.stringify(s.items) === JSON.stringify(targetState)
              );
              if (toIndex !== -1) {
                transitions.push({ from: fromIndex, to: toIndex, label: symbol });
              }
            });
          });
          
          const { nodes, edges} = prepareFlowData(generatedstates, transitions);
          
          
          setNodes(nodes);
          setEdges(edges);

        } catch (err) {
          setError(err.message);
          setState([]);
          setTableData(null);
        } finally {
          setIsProcessing(false);
        }
      };
      
      const onNodeClick = useCallback((_,node) => {
        const stateIndex = parseInt(node.id.replace("state", ''));
        setSelectedState(selectedState === stateIndex ? null : stateIndex);
      },[selectedState]);

    return (
      <div className="min-h-screen bg-gray-50">
        <nav className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-semibold text-gray-800">SLR Parser</h1>
            <button 
              onClick={handleParse}
              disabled={isProcessing || !input.trim()}
              className={`px-4 py-2 rounded-md transition-colors
                ${isProcessing || !input.trim() 
                  ? 'bg-gray-400 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              {isProcessing ? 'Processing...' : 'Generate Parser'}
            </button>
          </div>
        </nav>
  
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-4">
              <div className="bg-white rounded-lg shadow p-4">
                <label className="block mb-2 font-medium text-gray-700">
                  Production Rules
                </label>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Enter grammar rules (e.g., E -> E + T | T)"
                  className="w-full h-[calc(100vh-750px)] p-3 border rounded-md bg-gray-50 
                            focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                {tableData && (
                <div className="bg-white rounded-lg shadow">
                  <div className="p-4 border-b">
                    <h2 className="text-lg font-medium text-gray-900">Parsing Table</h2>
                  </div>
                  <div className="p-4 overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                            State
                          </th>
                          {tableData.columns.map((col, i) => (
                            <th key={i} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                              {col}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {tableData.rows.map((row, i) => (
                          <tr key={i}>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900">
                              {i}
                            </td>
                            {row.map((cell, j) => (
                              <td key={j} className="px-4 py-2 text-sm text-gray-500">
                                {cell || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
                {error && (
                  <div className="mt-2 p-3 bg-red-100 border border-red-300 rounded text-red-700">
                    {error}
                  </div>
                )}
              </div>
            </div>
  
            <div className="col-span-12 lg:col-span-8 space-y-6">
              
              <div className='col-span-8'>
                <div className='bg-white rounded-lg shadow'>
                  <div className='p-4'>
                  <div style={{ width: '100%', height: '600px' }}>
                      <ReactFlow
                        nodes={nodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onNodeClick={onNodeClick}
                      >
                        <Background />
                        <Controls />
                      </ReactFlow>
                    </div>
                  </div>
                </div>
              </div>

              
            </div>
          </div>
      </div>
    );
  }

