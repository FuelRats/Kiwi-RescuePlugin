import ClientStatusPoller from '@/plugins/fuelrats/lib/clientStatusApi';

function response(status, body) {
    return { ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) };
}

describe('ClientStatusPoller', () => {
    it('switches from the bootstrap token to the pinned token', async() => {
        let fetchFn = jest.fn()
            .mockResolvedValueOnce(response(404))
            .mockResolvedValueOnce(response(200, { rescue: { open: true, rats: [] }, token: 'pinned' }))
            .mockResolvedValueOnce(response(200, { rescue: { open: false, rats: [] } }));
        let onSnapshot = jest.fn();
        let poller = new ClientStatusPoller({
            apiUrl: 'https://api.example/', token: 'bootstrap', onSnapshot, fetchFn,
        });

        expect(await poller.tick()).toBeNull();
        await poller.tick();
        await poller.tick();

        let auth = fetchFn.mock.calls.map((c) => c[1].headers.Authorization);
        expect(auth).toEqual(['Bearer bootstrap', 'Bearer bootstrap', 'Bearer pinned']);
        expect(fetchFn.mock.calls[0][0]).toBe('https://api.example/rescues/client-status');
        expect(onSnapshot).toHaveBeenCalledTimes(2);
        expect(poller.stopped).toBe(true);
    });

    it('surfaces HTTP errors', async() => {
        let poller = new ClientStatusPoller({
            apiUrl: 'https://api.example',
            token: 't',
            onSnapshot: jest.fn(),
            fetchFn: jest.fn().mockResolvedValue(response(500)),
        });
        await expect(poller.tick()).rejects.toThrow('HTTP 500');
    });
});
