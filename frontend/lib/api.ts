
import type {
  CellEnvironment,
  SimulationConfig,
  SimulationSummary,
  TrajectoryState,
} from "./types";

import { MockSimulationApi } from "./mock-api";

export interface SimulationApi {
  getConfig(): Promise<SimulationConfig>;
  startSimulation(config: SimulationConfig): Promise<SimulationSummary>;
  getSimulationStatus(id: string): Promise<any>;
  getTrajectory(id: string): Promise<TrajectoryState[]>;
  getEnvironment(
    layer: string,
    x: number,
    y: number
  ): Promise<CellEnvironment>;
}

export class RealSimulationApi implements SimulationApi {
  private base =
    process.env.NEXT_PUBLIC_SIMULATION_API_URL ||
    "http://localhost:8000";

  private async request<T>(
    path: string,
    init?: RequestInit
  ): Promise<T> {
    const response = await fetch(`${this.base}${path}`, init);

    if (!response.ok) {
      throw new Error(
        `Backend error ${response.status}: ${await response.text()}`
      );
    }

    return response.json();
  }

  async getConfig(): Promise<SimulationConfig> {
    return this.request<SimulationConfig>("/config/default");
  }

  async startSimulation(config: SimulationConfig): Promise<SimulationSummary> {
    const response = await this.request<any>("/simulations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: config,
        runs: config.monteCarloRuns,
        interceptor_speed_m_s: config.interceptorMaxSpeedMps,
        seed: Number(config.randomSeed) || undefined,
      }),
    });

    return {
      id: response.job_id,
      status: response.status,
      outcome: "RUNNING",
      total: config.monteCarloRuns,
      completed: 0,
      successful: 0,
      failed: 0,
      meanInterceptionTimeS: 0,
      meanClosestApproachM: 0,
    };
  }

  getSimulationStatus(id: string): Promise<any> {
    return this.request<any>(`/simulations/${id}`);
  }

  async getTrajectory(_id: string): Promise<TrajectoryState[]> {
    throw new Error(
      "Trajectory endpoint is not implemented in the Python backend yet."
    );
  }

  async getEnvironment(
    _layer: string,
    _x: number,
    _y: number
  ): Promise<CellEnvironment> {
    throw new Error(
      "Environment endpoint is not implemented in the Python backend yet."
    );
  }
}

export const simulationApi: SimulationApi =
  process.env.NEXT_PUBLIC_SIMULATION_MODE === "real"
    ? new RealSimulationApi()
    : new MockSimulationApi();
