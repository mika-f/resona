console.info('Resona is ready');
document.querySelector('#log')!.addEventListener('click', () => {
  const circular: Record<string, unknown> = { message: 'Hello from browser', bigint: 123n };
  circular.self = circular;
  console.log('Snapshot:', circular, new Error('Example error'));
});
document.querySelector('#error')!.addEventListener('click', () => { throw new Error('Browser exception'); });
document.querySelector('#rejection')!.addEventListener('click', () => { void Promise.reject(new Error('Unhandled rejection')); });
