import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PhotoCaptureInput from '@/components/scanner/PhotoCaptureInput';
import { compressToBase64 } from '@/lib/imageCapture';

jest.mock('@/lib/imageCapture', () => ({ compressToBase64: jest.fn() }));

describe('PhotoCaptureInput', () => {
  beforeEach(() => {
    (compressToBase64 as jest.Mock).mockReset();
  });

  it('compresses the chosen photo and emits the base64 result', async () => {
    (compressToBase64 as jest.Mock).mockResolvedValue('base64jpeg');
    const onCaptured = jest.fn();
    render(<PhotoCaptureInput label="Photo of expiration date" onCaptured={onCaptured} />);

    const file = new File(['photo-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Photo of expiration date'), {
      target: { files: [file] },
    });

    await waitFor(() => expect(onCaptured).toHaveBeenCalledWith('base64jpeg'));
    expect(compressToBase64).toHaveBeenCalledWith(file);
  });

  it('emits nothing when compression fails', async () => {
    (compressToBase64 as jest.Mock).mockRejectedValue(new Error('bad image'));
    const onCaptured = jest.fn();
    render(<PhotoCaptureInput label="Photo of measure" onCaptured={onCaptured} />);

    const file = new File(['photo-bytes'], 'photo.jpg', { type: 'image/jpeg' });
    fireEvent.change(screen.getByLabelText('Photo of measure'), { target: { files: [file] } });

    await waitFor(() => expect(compressToBase64).toHaveBeenCalled());
    expect(onCaptured).not.toHaveBeenCalled();
  });
});
