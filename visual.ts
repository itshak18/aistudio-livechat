/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
/* tslint:disable */

import {LitElement, css, html} from 'lit';
import {customElement, property} from 'lit/decorators.js';
import {Analyser} from './analyser';

@customElement('gdm-live-audio-visuals')
export class GdmLiveAudioVisuals extends LitElement {
  private inputAnalyser: Analyser;
  private outputAnalyser: Analyser;

  private _outputNode: AudioNode;

  @property()
  set outputNode(node: AudioNode) {
    this._outputNode = node;
    this.outputAnalyser = new Analyser(this._outputNode);
  }

  get outputNode() {
    return this._outputNode;
  }

  private _inputNode: AudioNode;

  @property()
  set inputNode(node: AudioNode) {
    this._inputNode = node;
    this.inputAnalyser = new Analyser(this._inputNode);
  }

  private canvas: HTMLCanvasElement;
  private canvasCtx: CanvasRenderingContext2D;

  private currentInputHeights: number[] = [];
  private currentOutputHeights: number[] = [];
  private readonly SMOOTHING_FACTOR = 0.1;

  static styles = css`
    canvas {
      width: 400px;
      aspect-ratio: 1 / 1;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
  }

  private visualize() {
    if (this.canvas && this.outputAnalyser && this.inputAnalyser) {
      const WIDTH = this.canvas.width;
      const HEIGHT = this.canvas.height;
  
      if (this.currentInputHeights.length === 0) {
        const bufferLength = this.inputAnalyser.data.length;
        this.currentInputHeights = new Array(bufferLength).fill(0);
        this.currentOutputHeights = new Array(bufferLength).fill(0);
      }

      this.inputAnalyser.update();
      this.outputAnalyser.update();

      this.canvasCtx.clearRect(0, 0, WIDTH, HEIGHT);
      this.canvasCtx.fillStyle = '#1f2937';
      this.canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
      this.canvasCtx.globalCompositeOperation = 'lighter';

      const inputGradient = this.canvasCtx.createLinearGradient(0, 0, 0, HEIGHT);
      inputGradient.addColorStop(0, '#71B280');
      inputGradient.addColorStop(1, '#134E5E');
      
      this.drawBars(this.inputAnalyser, this.currentInputHeights, inputGradient);
      
      const outputGradient = this.canvasCtx.createLinearGradient(0, 0, 0, HEIGHT);
      outputGradient.addColorStop(0, '#00d4ff');
      outputGradient.addColorStop(1, '#003973');

      this.drawBars(this.outputAnalyser, this.currentOutputHeights, outputGradient);
    }
    requestAnimationFrame(() => this.visualize());
  }

  private drawBars(analyser: Analyser, currentHeights: number[], gradient: CanvasGradient) {
    const barCount = analyser.data.length;
    const barWidth = this.canvas.width / barCount;
    
    this.canvasCtx.fillStyle = gradient;

    for (let i = 0; i < barCount; i++) {
        const targetHeight = (analyser.data[i] / 255) * this.canvas.height;
        currentHeights[i] += (targetHeight - currentHeights[i]) * this.SMOOTHING_FACTOR;
        
        const barHeight = currentHeights[i];
        if (barHeight > 1) {
            this.canvasCtx.fillRect(i * barWidth, this.canvas.height - barHeight, barWidth, barHeight);
        }
    }
  }

  protected firstUpdated() {
    // FIX: Replaced `this.renderRoot` with `this.shadowRoot!` to correctly access the component's shadow DOM.
    this.canvas = this.shadowRoot!.querySelector('canvas')!;
    this.canvas.width = 400;
    this.canvas.height = 400;
    this.canvasCtx = this.canvas.getContext('2d')!;
    this.visualize();
  }

  protected render() {
    return html`<canvas></canvas>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'gdm-live-audio-visuals': GdmLiveAudioVisuals;
  }
}