import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ResumeUpload from '../components/ResumeUpload';
import client from '../api/client';
import { BrowserRouter } from 'react-router-dom';
import { useAnalysisStore } from '../store/analysisStore';
import { useGraphStore } from '../store/graphStore';

const { mockUseAnalysisStore } = vi.hoisted(() => ({
  mockUseAnalysisStore: Object.assign(
    vi.fn(() => ({
      setExtractedSkills: vi.fn(),
      setGapResult: vi.fn(),
      setRoadmap: vi.fn(),
    })),
    {
      getState: vi.fn(() => ({ refreshSkills: vi.fn().mockResolvedValue(undefined) })),
    }
  ),
}));

// Mock the API client
vi.mock('../api/client', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../store/analysisStore', () => ({
  useAnalysisStore: mockUseAnalysisStore,
}));

vi.mock('../store/graphStore', () => ({
  useGraphStore: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual as Record<string, unknown>,
    useNavigate: () => mockNavigate,
  };
});

describe('ResumeUpload Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useGraphStore).mockReturnValue({
      fetchGraphData: vi.fn().mockResolvedValue(undefined),
      setGraphData: vi.fn(),
    } as never);
    vi.mocked(useAnalysisStore).mockReturnValue({
      setExtractedSkills: vi.fn(),
      setGapResult: vi.fn(),
      setRoadmap: vi.fn(),
    } as never);
    vi.mocked(useAnalysisStore.getState).mockReturnValue({
      refreshSkills: vi.fn().mockResolvedValue(undefined),
    } as never);
  });

  it('accepts txt files supported by backend', async () => {
    render(<ResumeUpload />, { wrapper: BrowserRouter });
    const file = new File(['hello'], 'resume.txt', { type: 'text/plain' });
    const input = screen.getByLabelText(/resume upload/i) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText('resume.txt')).toBeInTheDocument();
  });

  it('starts polling and navigates to dashboard on success', async () => {
    const jobId = 'test-job-id';
    vi.mocked(client.post).mockResolvedValueOnce({ job_id: jobId });
    const setIntervalSpy = vi.spyOn(window, 'setInterval').mockImplementation((handler: TimerHandler) => {
      if (typeof handler === 'function') {
        setTimeout(() => handler(), 0);
        setTimeout(() => handler(), 0);
      }
      return 1 as unknown as number;
    });
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval').mockImplementation(() => undefined);
    
    // Calls: 
    // 1. checkStatus (polling start) -> 0%
    // 2. setInterval call 1 -> 50%
    // 3. setInterval call 2 -> 100%/complete
    vi.mocked(client.get)
      .mockResolvedValueOnce({ status: 'processing', progress_pct: 0 })
      .mockResolvedValueOnce({ status: 'processing', progress_pct: 50 })
      .mockResolvedValueOnce({ status: 'complete', progress_pct: 100, result: { skills: ['React', 'TypeScript'] } });

    render(<ResumeUpload />, { wrapper: BrowserRouter });
    
    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/resume upload/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const uploadButton = screen.getByText(/analyse my resume/i);
    fireEvent.click(uploadButton);

    await waitFor(() => expect(client.post).toHaveBeenCalled());

    // Verify 0%
    expect(await screen.findByText('0%')).toBeInTheDocument();

    // Verify completion and navigation
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'), { timeout: 5000 });
    expect(setIntervalSpy).toHaveBeenCalled();
    expect(clearIntervalSpy).toHaveBeenCalled();
    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('shows inline error message on job failure', async () => {
    const jobId = 'test-job-id';
    vi.mocked(client.post).mockResolvedValueOnce({ job_id: jobId });
    vi.mocked(client.get).mockResolvedValueOnce({ status: 'failed', error: 'Parsing failed' });

    render(<ResumeUpload />, { wrapper: BrowserRouter });
    
    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/resume upload/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fireEvent.click(screen.getByText(/analyse my resume/i));

    await waitFor(() => expect(screen.getByText(/parsing failed/i)).toBeInTheDocument());
  });

  it('shows validation error when upload completes with zero skills', async () => {
    const jobId = 'test-job-id';
    vi.mocked(client.post).mockResolvedValueOnce({ job_id: jobId });
    vi.mocked(client.get).mockResolvedValueOnce({ status: 'complete', result: { skills: [] } });

    render(<ResumeUpload />, { wrapper: BrowserRouter });

    const file = new File(['pdf content'], 'resume.pdf', { type: 'application/pdf' });
    const input = screen.getByLabelText(/resume upload/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.click(screen.getByText(/analyse my resume/i));

    await waitFor(() =>
      expect(screen.getByText(/no technical skills were found in this file/i)).toBeInTheDocument()
    );
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
