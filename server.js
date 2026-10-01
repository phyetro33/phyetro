import process from 'process';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY=process.env.GROQ_API_KEY

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
app.use(express.json());
app.use(express.static(__dirname));
app.use(express.static('publica'));


const user = [];

let historicoConversa = [];

const enviarArquivo = (res, nomeArquivo) => {
  const caminhoAbsoluto = path.resolve(__dirname, nomeArquivo);
  res.sendFile(caminhoAbsoluto, (err) => {
    if (err) {
      console.error(`[ERRO ARQUIVO] ${nomeArquivo}:`, err.message);
      res.status(404).send(`Arquivo ${nomeArquivo} non encontrado.`);
    }
  });
};

app.get('/', (req, res) => enviarArquivo(res, 'login.html'));
app.get('/interface', (req, res) => enviarArquivo(res, 'interface.html'));
app.get('/personagem', (req, res) => enviarArquivo(res, 'personagem.html'));


app.post('/cadastro', (req, res) => {
  const { usuario, email, senha } = req.body;

  if (!usuario || !email || !senha) {
    return res.status(400).json({
      erro: "Preencha todos os campos"
    });
  }

  if (senha.length < 6) {
    return res.status(400).json({
      erro: "A senha deve ter 6 caracteres ou mais"
    });
  }

  const emailExiste = user.find((busca) => busca.email === email);

  if (emailExiste) {
    return res.status(409).json({
      erro: "Email já cadastrado"
    });
  }

  console.log(`Recebido, aguarde 4 segundos`);
  user.push({ usuario, email, senha });

  setTimeout(() => {
    res.json({
      "mensagem": "CADASTRO COM SUCESSO",
      "PERFIL": `Usuario @${usuario} cadastrado com o email ${email}`
    });
    console.log(`O usuario cadastrado foi ${usuario}`);
  }, 4000);
});


app.post('/login', (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ erro: "Preencha todos os campos" });
  }

  const usuarioExiste = user.find((busca) => busca.email.toLowerCase() === email.toLowerCase());

  if (!usuarioExiste || usuarioExiste.senha !== senha) {
    return res.status(400).json({ erro: "Usuario ou senha incorretos!" });
  }

  return res.json({
    mensagem: " Login realizado com sucesso!",
    usuario: usuarioExiste.usuario
  });
});


app.post('/chat', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ reply: 'Mensagem vazia.' });
    }

    if (historicoConversa.length > 20) {
      historicoConversa = [];
    }

    const chaveLimpa = API_KEY.trim();

    const systemPrompt = {
      role: 'system',
      content: `Você É REALMENTE o Rimuru Tempest do anime "That Time I Got Reincarnated as a Slime". 
      Não aja como um assistente de inteligência artificial. Fale, pense e reaja exatamente como o personagem.
      Mantenha sua personalidade amigável, cômica, humilde e um pouco descontraída, mas responsável como líder da Federação Jura Tempest.
      REGRA DE CONVERSAÇÃO MANDATÓRIA: Você já se apresentou e disse quem você é no começo do diálogo. NÃO repita saudações formais, não diga "Olá, eu sou o Rimuru" ou "Aqui é o Rimuru" nas respostas seguintes, a menos que o usuário pergunte explicitamente sua identidade novamente. Responda de maneira fluida, natural e contínua, dando sequência ao que foi dito antes, como se conversasse com um amigo de longa data, reponda sempre de forma simples e direta.`
    };

    historicoConversa.push({ role: 'user', content: message });

    const mensagensParaEnviar = [systemPrompt, ...historicoConversa];

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b', 
        messages: mensagensParaEnviar
      })
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[ERRO GROQ LOG]:', JSON.stringify(data, null, 2));
      return res.status(response.status).json({ 
        reply: `Erro na API (${response.status}): ${data.error?.message || 'Verifique o terminal.'}` 
      });
    }

    if (data && data.choices && data.choices[0] && data.choices[0].message) {
      const reply = data.choices[0].message.content;
      
      historicoConversa.push({ role: 'assistant', content: reply });
      
      return res.json({ reply });
    }

    res.json({ reply: 'O Grande Sábio não encontrou uma resposta estruturada.' });

  } catch (error) {
    console.error('[ERRO NO SERVIDOR LOCAL]:', error.message);
    res.status(500).json({ 
      reply: 'Falha de comunicação no servidor local.' 
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de Tempest rodando perfeitamente em http://localhost:${PORT}`);
});