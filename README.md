# 🌐 Internet Livre (Jyy) — Plataforma de Conectividade Soberana & Comunicação Livre

<div align="center">

![Versão](https://img.shields.io/badge/Vers%C3%A3o-2.0.0-indigo?style=for-the-badge)
![Status](https://img.shields.io/badge/Rede-100%25%20Offline%20%26%20P2P-emerald?style=for-the-badge)
![Licença](https://img.shields.io/badge/Licen%C3%A7a-Open%20Source%20(MIT)-cyan?style=for-the-badge)
![Multiplataforma](https://img.shields.io/badge/Compatibilidade-Celulares%20%7C%20PCs%20%7C%20Roteadores%20%7C%20SDR-blue?style=for-the-badge)

</div>

> ### 📢 Apresentação do Projeto
> **O sistema foi desenvolvido para funcionar em celulares, computadores e diversos outros dispositivos, transformando-se em uma plataforma de interligação que permite a comunicação livre entre pessoas e máquinas. A proposta é oferecer uma forma de conexão flexível, acessível e independente de uma conexão convencional com a internet, possibilitando a comunicação por meio de outras tecnologias e alternativas de conectividade previstas no projeto.**

---

## 📖 Índice

- [Visão Geral](#-visão-geral)
- [Principais Funcionalidades](#-principais-funcionalidades)
- [Arquitetura dos Módulos](#-arquitetura-dos-módulos)
- [Globo 3D & Privacidade Diferencial (10 km)](#-globo-3d--privacidade-diferencial-10-km)
- [Nossa Internet Livre & Soberana](#-nossa-internet-livre--soberana)
- [Wi-Fi Radar & Visão Holográfica RuView](#-wi-fi-radar--visão-holográfica-ruview)
- [Omni-Protocol Hub & Sistema de Plugins](#-omni-protocol-hub--sistema-de-plugins)
- [Hardwares Suportados](#-hardwares-suportados)
- [Como Executar Localmente](#-como-executar-localmente)
- [Como Publicar na VPS Hostinger](#-como-publicar-na-vps-hostinger-jyycombr)
- [Segurança & Criptografia](#-segurança--criptografia)
- [Licença](#-licença)

---

## 🌟 Visão Geral

O sistema foi desenvolvido para funcionar em **celulares, computadores e diversos outros dispositivos**, transformando-se em uma plataforma de interligação que permite a **comunicação livre entre pessoas e máquinas**. 

A proposta é oferecer uma forma de conexão flexível, acessível e **independente de uma conexão convencional com a internet**, possibilitando a comunicação por meio de outras tecnologias e alternativas de conectividade previstas no projeto.

Cada computador, smartphone, roteador ou microcontrolador atuando na rede torna-se um **nó roteador soberano**, capaz de encaminhar pacotes de dados através de múltiplos meios físicos simultaneamente:
- **Rádio Sub-GHz (LoRa Meshtastic 433/868/915 MHz)**
- **Wi-Fi 802.11 ax/be com Radar CSI RuView (Sinais vitais e detecção de intrusão)**
- **Modem Acústico Subaquático (18 a 48 kHz através de água doce e salgada)**
- **Comunicação Óptica & Laser Azul-Verde Subaquático (450 a 532 nm)**
- **Rádio Tático HF/VHF/UHF & APRS AX.25**
- **Satélites de Órbita Baixa LEO & Iridium SBD**
- **Rede Celular 4G/5G com Gateways GL.iNet**
- **Canais Ópticos Air-Gapped via QR Code Stream e Som Aéreo (GGWave)**

---

## ⚡ Principais Funcionalidades

| Módulo | Descrição | Meio Físico |
| :--- | :--- | :--- |
| **🌍 Globo 3D da Terra** | Mapa 3D interativo para encontrar outros operadores com erro proposital de 10 km. | WebGL / 3D Canvas |
| **🗽 Internet Livre** | Manifesto, simulador de malha mesh comunitária e guia de autonomia. | Teoria & Prática Mesh |
| **📡 Wi-Fi Radar RuView** | Radar CSI com rastreamento de respiração, batimentos cardíacos e feixes multistáticos. | Micro-ondas 2.4/5GHz |
| **🔌 Omni-Protocol Hub** | Matriz com 16 protocolos físicos canônicos e loja de plugins instaláveis. | Multi-Camada Híbrida |
| **🌊 Subsea Internet** | Comunicação subaquática acústica e óptica para mergulho e submarinos. | Água Salgada / Doce |
| **📻 LoRa Meshtastic** | Enlace de longa distância (15 a 40 km) sem infraestrutura. | Rádio RF Sub-GHz |
| **🛰️ Satélite & SDR** | Recepção de telemetria orbital, boletins de emergência e rádio definido por software. | Banda L & VHF |
| **💬 Chat LAN & NGL** | Mensageria instantânea P2P local e envio anônimo com criptografia pós-quântica. | WebSocket / UDP |

---

## 🌍 Globo 3D & Privacidade Diferencial (10 km)

Na página inicial, os operadores da rede podem optar por serem visíveis publicamente no **Globo 3D da Terra** para fazer novas amizades e testar enlaces:

- **Aviso no Topo:** *"Quer ser visto por quem usa essa rede no mapa para conversar com novas pessoas?"*
- **Raio de Privacidade de 10 km:** As coordenadas reais de GPS passam por um algoritmo de *Differential Privacy Fuzzing*, adicionando um deslocamento proposital de exatamente 8 a 10 km.
- **Zona de Privacidade Visual:** Um círculo protetor de 10 km é desenhado ao redor de cada operador, impedindo qualquer triangulação residencial.
- **Chat P2P Integrado:** Clique em qualquer nó no globo para abrir uma conversa direta e verificar a distância aproximada.

---

## 🗽 Nossa Internet Livre & Soberana

Uma internet que não pode ser censurada nem desligada:
1. **Zero Servidores Centrais:** O tráfego pula de aparelho em aparelho em malha mesh.
2. **Resiliente a Guerras e Desastres:** Arquitetura *Store-and-Forward* tolerante a atrasos (DTN).
3. **Custo Zero:** Comunicação gratuita e perpétua.
4. **Simulador de Cobertura:** Permite simular a cobertura da sua cidade adicionando estações LoRa, Wi-Fi e Rádio HF.

---

## 📡 Wi-Fi Radar & Visão Holográfica RuView

Implementação completa dos protocolos e ADRs do projeto **RuView**:
- **Monitoramento de Sinais Vitais:** Frequência respiratória (0.1–0.5 Hz / 6–30 RPM) e cardíaca (0.8–2.0 Hz / 40–120 BPM) com osciloscópios animados em tempo real.
- **RuvSense Malha Multistática (ADR-029):** $N \times (N-1)$ feixes cruzados em 360° com salto TDM de 50ms entre os canais 1, 6 e 11.
- **Os 7 Níveis Exóticos (ADR-030):** Tomografia 3D por voxels, antecipação motora (200–500ms antes do movimento) e re-identificação dielétrica AETHER.
- **Triagem de Desastres START (ADR-001):** Detecção de sobreviventes sob escombros de concreto com classificação por cores.
- **Seleção de Dispositivos Conectados:** Use seu próprio roteador doméstico ou nós ESP32-S3 com 1 clique.

---

## 🔌 Omni-Protocol Hub & Sistema de Plugins

- **Terminal Despachante Unificado:** Transmita pacotes simultâneos por *Omni-Broadcast*, *Multipath Bonding* ou *Cascading Fallback*.
- **Loja de Plugins:** Instale drivers adicionais como *AX.25 Packet Radio*, *Starlink Mini*, *ESP-NOW Zero Latency*, *VLF Submarino 24kHz* e *Laser Gigabit FSO*.
- **Plugin Studio:** Crie, teste e exporte novos protocolos no formato `.jyyproto`.
- **Kill-Switch de Evasão:** Botão de emergência para silêncio total de RF contra guerra eletrônica.

---

## 🛠️ Hardwares Suportados

- **Microcontroladores:** ESP32, ESP32-S3, ESP32-C3, Raspberry Pi Pico W.
- **Módulos LoRa:** Semtech SX1262, Heltec WiFi LoRa 32 V3, LilyGO T-Beam, Ra-02.
- **Rádios Analógicos:** Baofeng UV-5R, Quansheng UV-K5, Xiegu G90, Icom, Yaesu.
- **Transdutores Subaquáticos:** Pastilhas piezocerâmicas PZT-5A, hidrofones passivos.
- **Óptica:** Diodos laser 450nm/532nm/1550nm e fotodiodos de avalanche (APD).
- **Rede e Computadores:** Qualquer PC com Windows 10/11, Linux, macOS ou smartphone via navegador.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- Node.js 18+ instalado.

### Passo a Passo
```bash
# 1. Clonar o repositório
git clone https://github.com/SEU_USUARIO/jyy.git
cd jyy

# 2. Instalar dependências
npm install

# 3. Rodar em modo de desenvolvimento
npm run dev

# 4. Iniciar o servidor local WebSocket + Web
npm run server
```

Acesse no navegador: `http://localhost:3000` ou `http://localhost:4870`.

---

## 🌐 Como Publicar na VPS Hostinger (`jyy.com.br`)

O repositório já inclui scripts prontos para colocar seu nó no ar na Hostinger:

1. **Aponte o DNS:** No painel do domínio, crie registros Tipo `A` para `@` e `www` apontando para o IP da sua VPS.
2. **Envie os arquivos:** No Windows, dê duplo clique em `ENVIAR-PARA-VPS-HOSTINGER.bat` e digite o IP da sua VPS.
3. **Execute o instalador:** Conecte via SSH (`ssh root@IP_DA_VPS`) e rode:
   ```bash
   cd /var/www/jyy
   bash install-vps-hostinger.sh
   ```
4. **Ative o SSL Grátis:**
   ```bash
   sudo certbot --nginx -d jyy.com.br -d www.jyy.com.br
   ```

Pronto! Seu nó estará ativo em `https://jyy.com.br`.

---

## 🔒 Segurança & Criptografia

- **Pós-Quântica:** Algoritmo ML-KEM (Kyber-1024) para encapsulamento de chaves.
- **Autenticação e Cifra:** XChaCha20-Poly1305 e Curve25519 de ponta a ponta.
- **Privacidade Espacial:** Fuzzing polar gaussiano garantindo 10 km de margem de erro contra rastreamento físico domiciliar.
- **Air-Gap:** Modems ópticos de tela para câmera e sonoros sem qualquer emissão de rádio.

---

## 📄 Licença

Distribuído sob a licença **MIT Open Source**. Livre para uso comunitário, civil, de resgate e educacional.
