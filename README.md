# 🌐 Internet Livre (Jyy)

<div align="center">

**Plataforma Soberana de Conectividade Multi-Dispositivo & Comunicação Descentralizada**

[![Licença](https://img.shields.io/badge/Licen%C3%A7a-MIT-cyan.svg?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Rede-100%25%20Offline%20%26%20P2P-emerald.svg?style=flat-square)](#)
[![Multiplataforma](https://img.shields.io/badge/Dispositivos-Celulares%20%7C%20PCs%20%7C%20Roteadores%20%7C%20SDR-indigo.svg?style=flat-square)](#)
[![Versão](https://img.shields.io/badge/Vers%C3%A3o-2.0.0-blue.svg?style=flat-square)](#)

</div>

---

### 📢 Apresentação do Projeto

> **O sistema foi desenvolvido para funcionar em celulares, computadores e diversos outros dispositivos, transformando-se em uma plataforma de interligação que permite a comunicação livre entre pessoas e máquinas. A proposta é oferecer uma forma de conexão flexível, acessível e independente de uma conexão convencional com a internet, possibilitando a comunicação por meio de outras tecnologias e alternativas de conectividade previstas no projeto.**

---

## ⚡ Principais Módulos

### 🌍 Globo 3D da Terra & Privacidade Total (10 km)
- **Mapa planetário em tempo real:** Visualização interativa de operadores e nós da rede mesh pelo mundo.
- **Privacidade com Ruído Deliberado:** O sistema adiciona um deslocamento proposital de **~10 km** na geolocalização do operador, desenhando um círculo protetor que impede a triangulação do endereço residencial.
- **Conexão Direta:** Permite conversar via chat P2P com outros operadores e novos nós descobertos no mapa.

### 📡 Radar Wi-Fi CSI (Estilo RuView)
- **Visão através de paredes sem câmeras:** Detecção de presença humana e sinais vitais (frequência respiratória de 6–30 RPM e cardíaca de 40–120 BPM) usando as microperturbações de sinal Wi-Fi.
- **Uso com Roteadores Comuns ou ESP32:** Opção de selecionar seu roteador doméstico ou nós dedicados para alimentar o radar em tempo real.
- **Triagem e Resgate:** Algoritmos para detecção de sobreviventes sob escombros e monitoramento sem invasão de privacidade.

### 🔌 Matriz de Conectividade & Meios Físicos
O sistema é capaz de saltar pacotes de dados por múltiplos meios simultâneos:

| Tecnologia | Alcance / Aplicação | Meio Físico |
| :--- | :--- | :--- |
| **LoRa (Sub-GHz)** | 15 a 40 km sem infraestrutura | Rádio RF (433/868/915 MHz) |
| **Wi-Fi 7 / ESP-NOW** | Redes locais de alta velocidade | Micro-ondas 2.4 / 5 / 6 GHz |
| **Modem Acústico** | Comunicação subaquática e pelo ar | Ultrassom e Áudio (18 a 48 kHz) |
| **Comunicação Óptica** | Enlaces air-gapped e subaquáticos | Luz visível, QR Code Stream e Laser |
| **Satélite & SDR** | Boletins e telemetria orbital | Rádio Definido por Software (Banda L/VHF) |
| **Redes em Malha P2P** | Rotas dinâmicas e sem censura | Reticulum, Yggdrasil, Tor e B.A.T.M.A.N. |

### 🛡️ Segurança & Criptografia
- Criptografia pós-quântica (Kyber-1024), ChaCha20-Poly1305 e assinaturas Ed25519.
- Arquitetura Zero-Knowledge: nenhum dado pessoal é armazenado em servidores centrais.

---

## 🚀 Como Executar

### Pré-requisitos
- [Node.js](https://nodejs.org/) versão 18 ou superior.
- Git instalado.

### 1. Clonar o repositório
```bash
git clone https://github.com/jjy-net/internet-livre.git
cd internet-livre
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Iniciar a aplicação
```bash
# Iniciar no navegador (Modo Web)
npm run dev

# Iniciar o servidor de rede e descoberta
npm start

# Iniciar como aplicativo Desktop
npm run electron
```

---

## 📄 Licença

Distribuído sob a licença **MIT**. Consulte o arquivo [LICENSE](LICENSE) para obter mais informações.  
*Este projeto é livre, aberto e comunitário — feito para que todos possam visualizar, testar, aprimorar e colaborar.*
