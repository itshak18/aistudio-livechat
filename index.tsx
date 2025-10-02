/* tslint:disable */
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI, LiveServerMessage, Modality, Session} from '@google/genai';
import {LitElement, css, html} from 'lit';
import {customElement, state} from 'lit/decorators.js';
import {createBlob, decode, decodeAudioData} from './utils';
import './visual-3d';
import {ifDefined} from 'lit/directives/if-defined.js';

@customElement('gdm-live-audio')
export class GdmLiveAudio extends LitElement {
  @state() isRecording = false;
  @state() status = '';
  @state() error = '';
  @state() selectedLanguage = 'en-US';

  private client: GoogleGenAI;
  private sessionPromise: Promise<Session>;
  // FIX: Cast window to `any` to access `webkitAudioContext` for older browser compatibility.
  private inputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 16000});
  // FIX: Cast window to `any` to access `webkitAudioContext` for older browser compatibility.
  private outputAudioContext = new (window.AudioContext ||
    (window as any).webkitAudioContext)({sampleRate: 24000});
  @state() inputNode = this.inputAudioContext.createGain();
  @state() outputNode = this.outputAudioContext.createGain();
  private nextStartTime = 0;
  private mediaStream: MediaStream;
  private sourceNode: AudioBufferSourceNode;
  private scriptProcessorNode: ScriptProcessorNode;
  private sources = new Set<AudioBufferSourceNode>();

  static styles = css`
    #status {
      position: absolute;
      bottom: 5vh;
      left: 0;
      right: 0;
      z-index: 10;
      text-align: center;
      color: white;
    }

    .controls {
      z-index: 10;
      position: absolute;
      bottom: 10vh;
      left: 0;
      right: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-direction: column;
      gap: 10px;

      button {
        outline: none;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: white;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.1);
        width: 64px;
        height: 64px;
        cursor: pointer;
        font-size: 24px;
        padding: 0;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;

        &:hover {
          background: rgba(255, 255, 255, 0.2);
        }
      }

      button[disabled] {
        display: none;
      }

      .language-selector {
        display: flex;
        align-items: center;
        margin-bottom: 10px;
        padding: 8px;
        border-radius: 12px;
        background: rgba(255, 255, 255, 0.1);
        border: 1px solid rgba(255, 255, 255, 0.2);

        label {
          color: white;
          font-size: 16px;
          margin-right: 10px;
        }

        select {
          outline: none;
          border: none;
          color: white;
          background: transparent;
          font-size: 16px;
          cursor: pointer;

          option {
            background: #222;
            color: white;
          }
        }
      }
    }
  `;

  constructor() {
    super();
    this.initClient();
  }

  private initAudio() {
    this.nextStartTime = this.outputAudioContext.currentTime;
  }

  private async initClient() {
    this.initAudio();

    this.client = new GoogleGenAI({
      apiKey: process.env.API_KEY,
    });

    this.outputNode.connect(this.outputAudioContext.destination);

    this.initSession();
  }

  private initSession() {
    // FIX: Use correct model name as per documentation.
    const model = 'gemini-2.5-flash-native-audio-preview-09-2025';

    try {
      this.sessionPromise = this.client.live.connect({
        model: model,
        callbacks: {
          onopen: () => {
            this.updateStatus('Opened');
          },
          onmessage: async (message: LiveServerMessage) => {
            const audio =
              message.serverContent?.modelTurn?.parts[0]?.inlineData;

            if (audio) {
              this.nextStartTime = Math.max(
                this.nextStartTime,
                this.outputAudioContext.currentTime,
              );

              const audioBuffer = await decodeAudioData(
                decode(audio.data),
                this.outputAudioContext,
                24000,
                1,
              );
              const source = this.outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(this.outputNode);
              source.addEventListener('ended', () => {
                this.sources.delete(source);
              });

              source.start(this.nextStartTime);
              this.nextStartTime = this.nextStartTime + audioBuffer.duration;
              this.sources.add(source);
            }

            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              for (const source of this.sources.values()) {
                source.stop();
                this.sources.delete(source);
              }
              this.nextStartTime = 0;
            }
          },
          onerror: (e: ErrorEvent) => {
            this.updateError(
              `Connection error: ${e.message}. Please check your internet connection and try resetting the session.`,
            );
          },
          onclose: (e: CloseEvent) => {
            this.updateStatus('Close:' + e.reason);
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {prebuiltVoiceConfig: {voiceName: 'Zephyr'}},
            languageCode: this.selectedLanguage,
          },
          systemInstruction: `You are an expert smoking cessation counselor specializing in Cognitive Behavioral Therapy (CBT). Your primary goal is to provide empathetic, supportive, and non-judgmental guidance to users trying to quit smoking.

Your core principles are:
1.  **Empathy and Support:** Always maintain a calm, encouraging, and understanding tone. Validate the user's feelings and struggles.
2.  **CBT Framework:**
    *   **Identify Triggers:** Help users recognize the situations, emotions, and routines that lead to cravings (e.g., morning coffee, stress, social events). Ask open-ended questions to explore these triggers.
    *   **Develop Coping Strategies:** Suggest practical, alternative behaviors to replace smoking. Use the "4 D's" as a starting point: Delay, Deep breaths, Drink water, Do something else (like taking a short walk, listening to music, or chewing gum).
    *   **Cognitive Restructuring (Challenge Negative Thoughts):** Help users identify and challenge automatic negative thoughts like "I can't do this" or "Just one cigarette won't hurt." Encourage them to reframe these thoughts into more positive or realistic ones, such as "This craving is temporary and I am strong enough to get through it" or "One cigarette will undermine my progress and I'll feel disappointed in myself."
3.  **Relapse Prevention:** If a user mentions a slip-up, do not be critical. Frame it as a learning opportunity. Help them analyze what led to the slip and how they can handle that trigger differently in the future.
4.  **Positive Reinforcement:** Acknowledge and celebrate small victories, whether it's resisting a single craving or getting through a whole day without smoking.
5.  **Keep it Conversational:** Use short, clear sentences suitable for a voice interface. Ask questions to keep the user engaged.

**Crucial Boundaries:**
*   You are NOT a medical doctor. Do NOT provide medical advice, recommend medications (like nicotine replacement therapy), or discuss specific health diagnoses.
*   If the user seems to be in extreme distress or mentions severe health issues, gently suggest they speak with a healthcare professional.

Example Interaction Starter: "Thank you for reaching out today. Taking this step is a powerful move towards a healthier life. How are you feeling right now?"`,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          // FIX: Removed undocumented config properties.
        },
      });
    } catch (e) {
      console.error(e);
      let friendlyMessage = `Failed to initialize session: ${e.message}`;
      if (!process.env.API_KEY) {
        friendlyMessage =
          'API Key is missing. Please make sure it is configured correctly.';
      } else if (e.message.includes('API key not valid')) {
        friendlyMessage = 'Your API Key is not valid. Please check it.';
      }
      this.updateError(friendlyMessage);
    }
  }

  private updateStatus(msg: string) {
    this.status = msg;
    this.error = '';
  }

  private updateError(msg: string) {
    this.error = msg;
    this.status = '';
  }

  private async startRecording() {
    if (this.isRecording) {
      return;
    }

    this.inputAudioContext.resume();

    this.updateStatus('Requesting microphone access...');

    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });

      this.updateStatus('Microphone access granted. Starting capture...');

      this.sourceNode = this.inputAudioContext.createMediaStreamSource(
        this.mediaStream,
      );
      this.sourceNode.connect(this.inputNode);

      const bufferSize = 4096;
      this.scriptProcessorNode = this.inputAudioContext.createScriptProcessor(
        bufferSize,
        1,
        1,
      );

      this.scriptProcessorNode.onaudioprocess = (audioProcessingEvent) => {
        if (!this.isRecording) return;

        const inputBuffer = audioProcessingEvent.inputBuffer;
        const pcmData = inputBuffer.getChannelData(0);

        this.sessionPromise.then((session) => {
          session.sendRealtimeInput({media: createBlob(pcmData)});
        });
      };

      this.sourceNode.connect(this.scriptProcessorNode);
      this.scriptProcessorNode.connect(this.inputAudioContext.destination);

      this.isRecording = true;
      this.updateStatus('🔴 Recording... Capturing PCM chunks.');
    } catch (err) {
      console.error('Error starting recording:', err);
      if (err.name === 'NotAllowedError') {
        this.updateStatus(
          'Microphone access denied. Please allow microphone access in your browser settings.',
        );
      } else {
        this.updateStatus(`Error starting recording: ${err.message}`);
      }
      this.stopRecording();
    }
  }

  private stopRecording() {
    if (!this.isRecording && !this.mediaStream && !this.inputAudioContext)
      return;

    this.updateStatus('Stopping recording...');

    this.isRecording = false;

    if (this.scriptProcessorNode && this.sourceNode && this.inputAudioContext) {
      this.scriptProcessorNode.disconnect();
      this.sourceNode.disconnect();
    }

    this.scriptProcessorNode = null;
    this.sourceNode = null;

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    this.updateStatus('Recording stopped. Click Start to begin again.');
  }

  private reset() {
    this.sessionPromise?.then((session) => session.close());
    this.initSession();
    this.updateStatus('Session cleared.');
  }

  private handleLanguageChange(e: Event) {
    const select = e.target as HTMLSelectElement;
    this.selectedLanguage = select.value;
    this.reset();
  }

  render() {
    return html`
      <div>
        <div class="controls">
          <div class="language-selector">
            <label for="language-select">Language</label>
            <select
              id="language-select"
              .value=${this.selectedLanguage}
              @change=${this.handleLanguageChange}
              ?disabled=${this.isRecording}>
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="fr-FR">French</option>
              <option value="de-DE">German</option>
              <option value="it-IT">Italian</option>
              <option value="es-ES">Spanish</option>
              <option value="ja-JP">Japanese</option>
              <option value="pt-BR">Portuguese (Brazil)</option>
              <option value="zh-CN">Mandarin (China)</option>
            </select>
          </div>
          <button
            id="resetButton"
            @click=${this.reset}
            ?disabled=${this.isRecording}
            aria-label="Reset Session">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="40px"
              viewBox="0 -960 960 960"
              width="40px"
              fill="#ffffff">
              <path
                d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z" />
            </svg>
          </button>
          <button
            id="startButton"
            @click=${this.startRecording}
            ?disabled=${this.isRecording}
            aria-label="Start Recording">
            <svg
              viewBox="0 0 100 100"
              width="32px"
              height="32px"
              fill="#c80000"
              xmlns="http://www.w3.org/2000/svg">
              <circle cx="50" cy="50" r="50" />
            </svg>
          </button>
          <button
            id="stopButton"
            @click=${this.stopRecording}
            ?disabled=${!this.isRecording}
            aria-label="Stop Recording">
            <svg
              viewBox="0 0 100 100"
              width="32px"
              height="32px"
              fill="#ffffff"
              xmlns="http://www.w3.org/2000/svg">
              <rect x="15" y="15" width="70" height="70" rx="10" />
            </svg>
          </button>
        </div>

        <div id="status">
          ${this.error ? `Error: ${this.error}` : this.status}
        </div>
        <gdm-live-audio-visuals-3d
          .inputNode=${this.inputNode}
          .outputNode=${this.outputNode}></gdm-live-audio-visuals-3d>
      </div>
    `;
  }
}