import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';


const STORAGE_KEY = 'crisp_unique_v1';


const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+\d{1,3}[\s-])?(?:\(\d{2,4}\)|\d{2,4})[\s-]?\d{3,4}[\s-]?\d{3,4}/g;


const QUESTION_BANK = [
  
  { text: 'What are strings in java?', difficulty: 'easy', timeLimit: 20 },
  { text: 'what are the applications of stack?', difficulty: 'easy', timeLimit: 20 },
  
  
  { text: 'Explain the difference between let, const, and var in JavaScript.', difficulty: 'medium', timeLimit: 60 },
  { text: 'How would you handle exception in java?.', difficulty: 'medium', timeLimit: 60 },
  
  
  { text: 'WAP to reverse a linkedlist.', difficulty: 'hard', timeLimit: 120 },
  { text: 'Implement a function to find the longest common subsequence between two strings. Explain your algorithm.', difficulty: 'hard', timeLimit: 120 }
];


const uid = () => Math.random().toString(36).slice(2, 9);

function save(state) {
  
}
function load() {
  
  return null;
}


function scoreAnswer(question, answer) {
  const ans = (answer || '').trim();
  if (!ans) return 0;
  const lenScore = Math.min(40, Math.floor(ans.split(/\s+/).length * 2)); 
  
  const qWords = (question || '').toLowerCase().match(/[a-z]{3,}/g) || [];
  let matches = 0;
  for (const w of qWords) if (ans.toLowerCase().includes(w)) matches += 1;
  const keywordScore = Math.min(40, matches * 8); 
  const rand = Math.floor(Math.random() * 21) - 10; 
  const total = Math.max(0, Math.min(100, lenScore + keywordScore + rand));
  return total;
}

function feedbackFor(score, answer) {
  if (!answer || answer.trim().length === 0) return 'No answer provided — try to answer next time.';
  if (score < 35) return 'Needs improvement: be concise and include clear steps or examples.';
  if (score < 70) return 'Good: you have some ideas. Add more detail and examples.';
  return 'Great: clear, detailed, and structured answer.';
}

export default function Interview() {
  
  const [store, setStore] = useState(() => load() || { candidates: [], lastInProgress: null });

  
  const [tab, setTab] = useState('interviewee');
  const [fileLoading, setFileLoading] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [resumeText, setResumeText] = useState('');
  const [currentId, setCurrentId] = useState(null);
  const [chat, setChat] = useState([]);
  const [overallSec, setOverallSec] = useState(0);
  const overallTimer = useRef(null);

  const [qIndex, setQIndex] = useState(0);
  const [running, setRunning] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [finalScore, setFinalScore] = useState(0);
  const [questionTimeLeft, setQuestionTimeLeft] = useState(0);
  const [currentAnswer, setCurrentAnswer] = useState('');
  const questionTimer = useRef(null);

  
  const [showWelcome, setShowWelcome] = useState(false); 

  
  useEffect(() => {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  }, []);

  

  
  useEffect(() => {
    if (running && questionTimeLeft > 0) {
      questionTimer.current = setInterval(() => {
        setQuestionTimeLeft(prev => {
          if (prev <= 1) {
            
            const answerToSubmit = currentAnswer || '';
            handleSubmitAnswer(answerToSubmit);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(questionTimer.current);
    }
    return () => clearInterval(questionTimer.current);
  }, [running, questionTimeLeft]); 

  
  function startQuestionTimer(targetIndex = qIndex) {
    const currentQuestion = QUESTION_BANK[targetIndex];
    if (currentQuestion) {
      setQuestionTimeLeft(currentQuestion.timeLimit);
    }
  }

  
  function upsertCandidate(c) {
    setStore(prev => {
      const others = prev.candidates.filter(x => x.id !== c.id);
      return { ...prev, candidates: [c, ...others] };
    });
  }

  
  async function handleFile(f) {
    if (!f) return;
    setFileLoading(true);
    try {
      if (f.type === 'application/pdf') {
        const buffer = await f.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
        let full = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          const p = await pdf.getPage(i);
          const content = await p.getTextContent();
          const pageStr = content.items.map(it => it.str).join(' ');
          full += '\n' + pageStr;
        }
        setResumeText(full);
        
        const emails = full.match(EMAIL_RE) || [];
        const phones = full.match(PHONE_RE) || [];
        
        const lines = full.split(/\n+/).map(l => l.trim()).filter(Boolean);
        let name = '';
        for (const ln of lines.slice(0, 8)) {
          if (/^[A-Z][a-z]+\s+[A-Z][a-z]+/.test(ln)) { name = ln.split(/[\n,|]+/)[0]; break; }
        }
        setForm(fv => ({ ...fv, name: name || fv.name, email: emails[0] || fv.email, phone: phones[0] || fv.phone }));
      } else {
        const txt = await f.text().catch(() => '');
        setResumeText(txt);
      }
    } catch (e) {
      console.error(e); alert('Failed to parse resume — please fill fields manually.');
    } finally { setFileLoading(false); }
  }

  
  function startInterview() {
    if (!form.name || !form.email) return alert('Please add at least name and email.');
    const id = uid();
    const cand = {
      id,
      name: form.name,
      email: form.email,
      phone: form.phone,
      resumeText,
      chat: [],
      status: 'in-progress',
      createdAt: new Date().toISOString(),
      score: 0,
      elapsed: 0,
      qIndex: 0
    };
    upsertCandidate(cand);
    setCurrentId(id); 
    setChat([]); 
    setRunning(true); 
    setQIndex(0); 
    setCurrentAnswer('');
    setTab('interviewee');
    
    setTimeout(() => {
      const firstQ = QUESTION_BANK[0];
      setChat([{ from: 'ai', text: firstQ.text, time: new Date().toISOString(), difficulty: firstQ.difficulty }]);
      startQuestionTimer(0);
    }, 200);
  }


  
  function handleSubmitAnswer(text) {
    if (!currentId) {
      
      setQIndex(i => i + 1);
      return;
    }
    const question = QUESTION_BANK[qIndex] || { text: '—' };

    
    const sc = scoreAnswer(question.text, text);
    const userMsg = { from: 'candidate', text, time: new Date().toISOString(), score: sc };
    const newChat = [...chat, userMsg];
    setChat(newChat);

    
    const cand = store.candidates.find(c => c.id === currentId) || {};
    const allChat = [...(cand.chat || []), userMsg];
    const avg = computeAverageScore(allChat);
    upsertCandidate({ ...cand, chat: allChat, qIndex: qIndex + 1, score: avg });

    
    setCurrentAnswer('');
    clearInterval(questionTimer.current);
    setQuestionTimeLeft(0);

    
    const nextIndex = qIndex + 1;
    setQIndex(nextIndex);
    if (nextIndex >= QUESTION_BANK.length) {
      
      finishInterview(currentId);
    } else {
      
      setTimeout(() => {
        const nextQ = QUESTION_BANK[nextIndex];
        setChat(prev => [...prev, { from: 'ai', text: nextQ.text, time: new Date().toISOString(), difficulty: nextQ.difficulty }]);
        startQuestionTimer(nextIndex);
      }, 300);
    }
  }

  function computeAverageScore(chatArr) {
    const scores = (chatArr || []).filter(m => m.score !== undefined).map(m => m.score);
    if (!scores.length) return 0; return Math.round(scores.reduce((a,b)=>a+b,0)/scores.length);
  }

  function finishInterview(id) {
    setRunning(false);
    clearInterval(questionTimer.current);
    setQuestionTimeLeft(0);
    const cand = store.candidates.find(c => c.id === id) || {};
    const avg = computeAverageScore(cand.chat || []);
    upsertCandidate({ ...cand, status: 'completed', elapsed: 0, score: avg });
    setFinalScore(avg);
    setShowResult(true);
    setCurrentId(null);
    setChat([]);
    setCurrentAnswer('');
  }

  
  function selectCandidate(id) {
    setTab('interviewer'); setCurrentId(id);
  }

  
  function resumeFound() { /* no-op */ }
  function pauseFound() { /* no-op */ }

  
  const sorted = useMemo(() => [...store.candidates].sort((a,b)=> (b.score||0)-(a.score||0)), [store.candidates]);

  return (
    <div style={{padding:20}}>
      <header style={{maxWidth:900, margin:'0 auto 20px'}}>
        <h1 style={{fontSize:22, fontWeight:700}}>Interview Assistant</h1>
        
      </header>

      <main style={{maxWidth:900, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 2fr', gap:20}}>
        <aside style={{background:'#fff', padding:16, borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
          <div style={{display:'flex', gap:8}}>
            <button onClick={() => setTab('interviewee')} style={{padding:'8px 12px', borderRadius:6, background: tab==='interviewee' ? '#4f46e5' : '#eef2ff', color: tab==='interviewee' ? '#fff' : '#111'}}>Interviewee</button>
            <button onClick={() => setTab('interviewer')} style={{padding:'8px 12px', borderRadius:6, background: tab==='interviewer' ? '#4f46e5' : '#f3f4f6', color: tab==='interviewer' ? '#fff' : '#111'}}>Interviewer</button>
          </div>

          <div style={{marginTop:12}}>
            <div style={{fontSize:12, color:'#6b7280'}}>Candidates</div>
            <div style={{marginTop:8, maxHeight:320, overflow:'auto'}}>
              {sorted.length === 0 && <div style={{fontSize:13, color:'#6b7280'}}>No candidates yet — add from Interviewee tab.</div>}
              {sorted.map(c => (
                <div key={c.id} onClick={() => selectCandidate(c.id)} style={{padding:12, background:'#fff', borderRadius:8, marginBottom:8, boxShadow:'0 1px 2px rgba(0,0,0,0.04)'}}>
                  <div style={{display:'flex', justifyContent:'space-between'}}>
                    <div>
                      <div style={{fontWeight:600}}>{c.name}</div>
                      <div style={{fontSize:12, color:'#6b7280'}}>{c.email}{c.phone ? ` • ${c.phone}` : ''}</div>
                      <div style={{fontSize:11, color:'#9ca3af'}}>Status: {c.status || 'new'}</div>
                    </div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontWeight:700}}>{c.score || 0}</div>
                      <button onClick={(e)=>{ e.stopPropagation(); selectCandidate(c.id); }} style={{marginTop:6, padding:'6px 10px', borderRadius:6}}>Open</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{marginTop:12, fontSize:12, color:'#6b7280'}}>Local persistence: progress is saved in localStorage.</div>
          </div>
        </aside>

        <section style={{gridColumn:'2 / span 1'}}>
          {tab === 'interviewee' ? (
            <div style={{background:'#fff', padding:16, borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
              <h2 style={{fontWeight:700}}>Interviewee — Upload Resume & Start Interview</h2>

              <div style={{display:'flex', gap:12, marginTop:12}}>
                <div style={{flex:1}}>
                  <label style={{fontSize:13}}>Upload Resume (PDF preferred)</label>
                  <input type="file" accept=".pdf,.docx" onChange={(e)=> handleFile(e.target.files?.[0])} style={{display:'block', marginTop:8}} />
                  {fileLoading && <div style={{fontSize:13, color:'#6b7280'}}>Parsing resume…</div>}
                </div>

                <div style={{flex:1}}>
                  <label style={{fontSize:13}}>Candidate Details</label>
                  <input placeholder="Full name" value={form.name} onChange={(e)=> setForm(f => ({...f, name: e.target.value}))} style={{display:'block', marginTop:8, padding:8, width:'100%'}} />
                  <input placeholder="Email" value={form.email} onChange={(e)=> setForm(f => ({...f, email: e.target.value}))} style={{display:'block', marginTop:8, padding:8, width:'100%'}} />
                  <input placeholder="Phone (optional)" value={form.phone} onChange={(e)=> setForm(f => ({...f, phone: e.target.value}))} style={{display:'block', marginTop:8, padding:8, width:'100%'}} />
                </div>
              </div>

              <div style={{marginTop:12}}>
                <button onClick={startInterview} style={{padding:'8px 14px', borderRadius:6, background:'#10b981', color:'#fff'}}>Start Interview</button>
              </div>

              <div style={{marginTop:16}}>
                <div style={{fontWeight:600}}>Live Chat</div>
                <div style={{marginTop:8, maxHeight:360, overflow:'auto', padding:8, background:'#f9fafb', borderRadius:8}}>
                  {chat.length === 0 && <div style={{color:'#6b7280'}}>No messages yet — start the interview to get AI questions.</div>}
                  {chat.map((m,i)=>(
                    <div key={i} style={{padding:10, marginBottom:8, borderRadius:8, background: m.from === 'ai' ? '#fff' : '#ecfeff' }}>
                      <div style={{fontSize:12, color:'#6b7280'}}>
                        {m.from === 'ai' ? 'Interviewer (AI)' : form.name || 'You'} • {new Date(m.time).toLocaleTimeString()}
                        {m.difficulty && <span style={{marginLeft:8, padding:'2px 6px', borderRadius:4, background:'#e5e7eb', fontSize:10}}>{m.difficulty}</span>}
                      </div>
                      <div style={{marginTop:6}}>{m.text}</div>
                    </div>
                  ))}
                </div>

                {running && qIndex < QUESTION_BANK.length && (
                  <div style={{marginTop:12, padding:12, background:'#fef3c7', borderRadius:8, border:'1px solid #f59e0b'}}>
                    <div style={{fontWeight:600, color:'#92400e'}}>
                      Question {qIndex + 1} of {QUESTION_BANK.length} 
                      {QUESTION_BANK[qIndex] && (
                        <span style={{marginLeft:8, padding:'2px 8px', borderRadius:4, background:'#f59e0b', color:'#fff', fontSize:12}}>
                          {QUESTION_BANK[qIndex].difficulty}
                        </span>
                      )}
                    </div>
                    <div style={{marginTop:4, fontSize:14, color:'#92400e', display:'flex', alignItems:'center', gap:8}}>
                      <span>Time remaining: {questionTimeLeft} seconds</span>
                      <div style={{
                        width: 12,
                        height: 12,
                        borderRadius: '50%',
                        background: questionTimeLeft > 10 ? '#10b981' : questionTimeLeft > 5 ? '#f59e0b' : '#ef4444',
                        animation: 'pulse 1s infinite'
                      }}></div>
                    </div>
                    <div style={{marginTop:4, fontSize:12, color:'#92400e', fontStyle:'italic'}}>
                      Timer runs continuously - type your answer while time counts down
                    </div>
                  </div>
                )}

                <div style={{marginTop:12, display:'flex', gap:8}}>
                  <textarea 
                    rows={3} 
                    placeholder="Write your answer here..." 
                    style={{flex:1, padding:8}} 
                    value={currentAnswer} 
                    onChange={(e)=> setCurrentAnswer(e.target.value)} 
                  />
                  <div style={{width:160}}>
                    <button 
                      style={{marginTop:8, padding:8, width:'100%', borderRadius:6, background:'#2563eb', color:'#fff'}} 
                      onClick={()=>{
                        if (!currentAnswer.trim()) return alert('Please write an answer before submitting.');
                        handleSubmitAnswer(currentAnswer);
                      }}
                    >
                      Submit Answer
                    </button>
                    <button 
                      style={{marginTop:8, padding:8, width:'100%', borderRadius:6, background:'#10b981', color:'#fff'}} 
                      onClick={()=> currentId && finishInterview(currentId)}
                    >
                      Submit Interview
                    </button>
                    {running && (
                      <div style={{marginTop:10, fontSize:13, color:'#6b7280'}}>
                        Question {qIndex + 1} of {QUESTION_BANK.length}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{background:'#fff', padding:16, borderRadius:8, boxShadow:'0 1px 3px rgba(0,0,0,0.06)'}}>
              <h2 style={{fontWeight:700}}>Interviewer Dashboard</h2>

              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginTop:12}}>
                <div>
                  <div style={{fontSize:12, color:'#6b7280'}}>Candidates (sorted by score)</div>
                  <div style={{marginTop:8, maxHeight:420, overflow:'auto'}}>
                    {sorted.map(c => (
                      <div key={c.id} style={{marginBottom:8}}>
                        <div style={{padding:12, background:'#fff', borderRadius:8, boxShadow:'0 1px 2px rgba(0,0,0,0.04)'}}>
                          <div style={{display:'flex', justifyContent:'space-between'}}>
                            <div>
                              <div style={{fontWeight:600}}>{c.name}</div>
                              <div style={{fontSize:12, color:'#6b7280'}}>{c.email}{c.phone ? ` • ${c.phone}` : ''}</div>
                              <div style={{fontSize:11, color:'#9ca3af'}}>Status: {c.status || 'new'}</div>
                            </div>
                            <div style={{textAlign:'right'}}>
                              <div style={{fontWeight:700}}>{c.score || 0}</div>
                              <button onClick={()=> selectCandidate(c.id)} style={{marginTop:6, padding:'6px 10px', borderRadius:6}}>Open</button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <div style={{fontSize:12, color:'#6b7280'}}>Selected Candidate</div>
                  {currentId ? (()=>{ const c = store.candidates.find(x=>x.id===currentId); if(!c) return <div>No candidate found.</div>;
                    return (
                      <div style={{padding:12, borderRadius:8, background:'#f9fafb', maxHeight:420, overflow:'auto'}}>
                        <div style={{fontWeight:700}}>{c.name}</div>
                        <div style={{fontSize:13, color:'#6b7280'}}>{c.email} {c.phone ? `• ${c.phone}` : ''}</div>
                        <div style={{marginTop:8, fontSize:13}}>Summary</div>
                        <div style={{marginTop:6, fontSize:13}}>{c.summary || 'No summary yet.'}</div>

                        <div style={{marginTop:8, fontSize:13}}>Resume Text</div>
                        <div style={{marginTop:6, maxHeight:120, overflow:'auto', background:'#fff', padding:8, borderRadius:6}}>{c.resumeText ? c.resumeText.slice(0,200)+'...' : 'No resume text stored.'}</div>

                        <div style={{marginTop:8, fontSize:13}}>Chat history</div>
                        <div style={{marginTop:6}}>
                          {(c.chat || []).map((m,i)=>(
                            <div key={i} style={{padding:8, marginBottom:8, borderRadius:6, background:m.from==='ai' ? '#fff' : '#ecfeff'}}>
                              <div style={{fontSize:12, color:'#6b7280'}}>{m.from==='ai' ? 'AI' : c.name} • {new Date(m.time).toLocaleString()}</div>
                              <div style={{marginTop:6}}>{m.text}</div>
                            </div>
                          ))}
                        </div>

                          <div style={{marginTop:8, display:'flex', gap:8}}>
                          <button onClick={()=>{ const avg = computeAverageScore(c.chat||[]); upsertCandidate({...c, summary:`Candidate ${c.name} — Average score ${avg}.`, score:avg}); }} style={{padding:8, borderRadius:6, background:'#4f46e5', color:'#fff'}}>Generate Summary</button>
                          
                        </div>
                      </div>
                    );
                  })() : <div style={{fontSize:13, color:'#6b7280'}}>Select a candidate to view details.</div>}
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Welcome modal removed */}

    {/* Result modal */}
    {showResult && (
        <div style={{position:'fixed', left:0, right:0, top:0, bottom:0, background:'rgba(0,0,0,0.4)', display:'flex', alignItems:'center', justifyContent:'center'}}>
        <div style={{background:'#fff', padding:20, borderRadius:8, width:420}}>
          <h3 style={{fontWeight:700}}>Interview Submitted</h3>
          <p style={{marginTop:8}}>Your overall score: <span style={{fontWeight:700}}>{finalScore}/100</span></p>
          <div style={{marginTop:12, display:'flex', gap:8, justifyContent:'flex-end'}}>
            <button onClick={()=>{ setShowResult(false); setTab('interviewer'); }} style={{padding:8, borderRadius:6, background:'#4f46e5', color:'#fff'}}>OK</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
