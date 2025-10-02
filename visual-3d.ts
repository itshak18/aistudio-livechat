/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// tslint:disable:organize-imports
// tslint:disable:ban-malformed-import-paths
// tslint:disable:no-new-decorators

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {Analyser} from './analyser';

/**
 * Fullscreen audio waveform visualization.
 */
@customElement('gdm-live-audio-visuals-3d')
export class GdmLiveAudioVisuals3D extends LitElement {
  private inputAnalyser!: Analyser;
  private outputAnalyser!: Analyser;

  private _outputNode!: AudioNode;

  @property()
  set outputNode(node: AudioNode) {
    this._outputNode = node;
    this.outputAnalyser = new Analyser(this._outputNode);
  }

  get outputNode() {
    return this._outputNode;
  }

  private _inputNode!: AudioNode;

  @property()
  set inputNode(node: AudioNode) {
    this._inputNode = node;
    this.inputAnalyser = new Analyser(this._inputNode);
  }

  private canvas!: HTMLCanvasElement;
  private canvasCtx!: CanvasRenderingContext2D;

  private currentInputHeights: number[] = [];
  private currentOutputHeights: number[] = [];
  private readonly SMOOTHING_FACTOR = 0.1;

  static styles = css`
    canvas {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      z-index: -1;
      background-color: #100c14;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('resize', () => this.handleResize());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('resize', () => this.handleResize());
  }

  private handleResize() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.canvasCtx.scale(dpr, dpr);
  }

  private animation() {
    requestAnimationFrame(() => this.animation());

    if (!this.inputAnalyser || !this.outputAnalyser) return;

    this.inputAnalyser.update();
    this.outputAnalyser.update();

    if (this.currentInputHeights.length === 0) {
      const bufferLength = this.inputAnalyser.data.length;
      this.currentInputHeights = new Array(bufferLength).fill(0);
      this.currentOutputHeights = new Array(bufferLength).fill(0);
    }

    const {width, height} = this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const scaledWidth = width / dpr;
    const scaledHeight = height / dpr;

    this.canvasCtx.clearRect(0, 0, width, height);
    this.canvasCtx.globalCompositeOperation = 'lighter';

    const outputGradient = this.canvasCtx.createLinearGradient(
      0,
      scaledHeight,
      0,
      0,
    );
    outputGradient.addColorStop(0, '#003973');
    outputGradient.addColorStop(1, '#00d4ff');
    this.drawBars(
      this.outputAnalyser,
      this.currentOutputHeights,
      outputGradient,
    );

    const inputGradient = this.canvasCtx.createLinearGradient(
      0,
      scaledHeight,
      0,
      0,
    );
    inputGradient.addColorStop(0, '#134E5E');
    inputGradient.addColorStop(1, '#71B280');
    this.drawBars(
      this.inputAnalyser,
      this.currentInputHeights,
      inputGradient,
    );
  }

  private drawBars(
    analyser: Analyser,
    currentHeights: number[],
    gradient: CanvasGradient,
  ) {
    const barCount = analyser.data.length;
    const dpr = window.devicePixelRatio || 1;
    const scaledWidth = this.canvas.width / dpr;
    const scaledHeight = this.canvas.height / dpr;
    const barWidth = scaledWidth / barCount;

    this.canvasCtx.fillStyle = gradient;

    for (let i = 0; i < barCount; i++) {
      const targetHeight = (analyser.data[i] / 255) * scaledHeight;
      currentHeights[i] += (targetHeight - currentHeights[i]) * this.SMOOTHING_FACTOR;

      const barHeight = currentHeights[i];
      if (barHeight > 1) {
        this.canvasCtx.fillRect(
          i * barWidth,
          scaledHeight - barHeight,
          barWidth,
          barHeight,
        );
      }
    }
  }

  protected firstUpdated() {
    // FIX: Replaced `this.renderRoot` with `this.shadowRoot!` to correctly access the component's shadow DOM.
    this.canvas = this.shadowRoot!.querySelector('canvas')!;
    this.canvasCtx = this.canvas.getContext('2d')!;
    this.handleResize();
    this.animation();
  }

  protected render() {
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-live-audio-visuals-3d': GdmLiveAudioVisuals3D;
  }
}