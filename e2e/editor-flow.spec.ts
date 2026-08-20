import { expect, test, type Locator } from '@playwright/test';

const pngFixture = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

async function expectInlineMargins(
  wrapper: Locator,
  marginLeft: string,
  marginRight: string,
): Promise<void> {
  await expect
    .poll(() =>
      wrapper.evaluate((element) => {
        const style = (element as HTMLElement).style;

        return [style.marginLeft, style.marginRight];
      }),
    )
    .toEqual([marginLeft, marginRight]);
}

test('intro HTML을 편집하고 저장한 뒤 정규화 HTML을 다시 불러온다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'intro fixture 불러오기' }).click();

  const editor = page.getByRole('textbox', { name: 'HTML 편집 내용' });
  await expect(editor).toContainText('음성인식(STT)은');

  await editor.press('Control+End');
  await editor.pressSequentially(' 브라우저편집');
  await editor.press('Control+Shift+ArrowLeft');
  await page.getByRole('button', { name: '굵게' }).click();
  await page.getByRole('textbox', { name: '글자색', exact: true }).fill('#c2410c');
  await editor.press('Control+End');

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: '이미지 추가' }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: 'browser-fixture.png',
    mimeType: 'image/png',
    buffer: pngFixture,
  });
  await expect(editor.getByRole('img', { name: 'browser-fixture.png' })).toBeVisible();

  await editor.press('Control+End');
  await page.getByRole('button', { name: '표 삽입' }).click();
  await expect(editor.getByRole('table')).toBeVisible();

  await page.getByRole('button', { name: '서버에 저장' }).click();
  const savedHtml = page.getByLabel('서버 저장 HTML');
  await expect(savedHtml).toContainText('브라우저편집');
  await expect(savedHtml).toContainText('<strong>');
  await expect(savedHtml).toContainText(/color: (?:#c2410c|rgb\(194, 65, 12\))/);
  await expect(savedHtml).toContainText('<img src="data:image/png;base64,');
  await expect(savedHtml).toContainText('alt="browser-fixture.png"');
  await expect(savedHtml).toContainText('<table');
  const normalizedHtml = await savedHtml.textContent();

  await editor.press('Control+End');
  await editor.pressSequentially(' 저장 이후 변경');
  await page.getByRole('button', { name: '저장값 다시 불러오기' }).click();

  await expect(editor).toContainText('브라우저편집');
  await expect(editor).not.toContainText('저장 이후 변경');
  await expect(editor.locator('strong').filter({ hasText: '브라우저편집' })).toBeVisible();
  await expect(editor.locator('span').filter({ hasText: '브라우저편집' })).toHaveCSS(
    'color',
    'rgb(194, 65, 12)',
  );
  await expect(editor.getByRole('img', { name: 'browser-fixture.png' })).toBeVisible();
  await expect(editor.getByRole('table')).toBeVisible();

  await editor.press('Control+End');
  await editor.pressSequentially('직렬화확인');
  await page.getByRole('button', { name: '서버에 저장' }).click();
  await expect(savedHtml).toContainText('직렬화확인');

  await editor.press('Control+Shift+ArrowLeft');
  await editor.press('Backspace');
  await page.getByRole('button', { name: '서버에 저장' }).click();
  await expect(savedHtml).toHaveText(normalizedHtml ?? '');
});

test('unsafe HTML을 불러오면 실행 가능한 markup을 제거한다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'unsafe fixture 불러오기' }).click();

  const editor = page.getByRole('textbox', { name: 'HTML 편집 내용' });
  await expect(editor).toContainText('event handler와 지원하지 않는 style은 제거됩니다.');
  await expect(editor).toContainText('javascript URL은 링크로 유지되지 않습니다.');
  await expect(editor.locator('script')).toHaveCount(0);
  await expect(editor.locator('[onclick]')).toHaveCount(0);
  await expect(editor.locator('a[href^="javascript:"]')).toHaveCount(0);
});

test('이미지를 drag resize하고 저장한 너비로 다시 불러온다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '이미지 fixture 불러오기' }).click();

  const editor = page.getByRole('textbox', { name: 'HTML 편집 내용' });
  const image = editor.getByRole('img', { name: '크기 조절 demo 이미지' });
  await expect(image).toBeVisible();
  const before = await image.boundingBox();
  expect(before).not.toBeNull();

  await image.click();
  const handle = page.getByRole('button', { name: '이미지 크기 조절' });
  await expect(handle).toBeVisible();

  await editor.locator('p').filter({ hasText: '이미지 추가 버튼' }).click();
  await expect(handle).toBeHidden();
  await image.click();
  await expect(handle).toBeVisible();

  const handleBox = await handle.boundingBox();
  expect(handleBox).not.toBeNull();

  await page.mouse.move(
    (handleBox?.x ?? 0) + (handleBox?.width ?? 0) / 2,
    (handleBox?.y ?? 0) + (handleBox?.height ?? 0) / 2,
  );
  await page.mouse.down();
  await page.mouse.move((handleBox?.x ?? 0) + 100, (handleBox?.y ?? 0) + 5);
  await page.mouse.up();
  await expect(handle).toBeVisible();

  const resized = await image.boundingBox();
  expect(resized).not.toBeNull();
  expect(Math.round(resized?.width ?? 0)).toBeGreaterThan(Math.round(before?.width ?? 0));
  expect(Math.round((resized?.width ?? 1) / (resized?.height ?? 1))).toBe(
    Math.round((before?.width ?? 1) / (before?.height ?? 1)),
  );

  await page.getByRole('button', { name: '서버에 저장' }).click();
  const savedHtml = page.getByLabel('서버 저장 HTML');
  await expect(savedHtml).toContainText(/width="[2-9][0-9]{2}"/);
  await expect(savedHtml).not.toContainText('height="');
  await expect(savedHtml).not.toContainText('editor-simple__image');
  const savedWidth = Math.round(resized?.width ?? 0);

  await editor.press('Control+End');
  await editor.pressSequentially('저장 이후 변경');
  await page.getByRole('button', { name: '저장값 다시 불러오기' }).click();

  await expect(image).toBeVisible();
  await expect
    .poll(async () => Math.round((await image.boundingBox())?.width ?? 0))
    .toBe(savedWidth);
});

test('이미지를 정렬하고 저장한 상태로 다시 불러온다', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '이미지 fixture 불러오기' }).click();

  const editor = page.getByRole('textbox', { name: 'HTML 편집 내용' });
  const image = editor.getByRole('img', { name: '크기 조절 demo 이미지' });
  const wrapper = image.locator('..');
  const controls = ['이미지 왼쪽 정렬', '이미지 가운데 정렬', '이미지 오른쪽 정렬'] as const;

  await expect(image).toBeVisible();
  await image.click();

  for (const [label, margins] of [
    ['이미지 왼쪽 정렬', ['0px', 'auto']],
    ['이미지 가운데 정렬', ['auto', 'auto']],
    ['이미지 오른쪽 정렬', ['auto', '0px']],
  ] as const) {
    await page.getByRole('button', { name: label, exact: true }).click();

    for (const controlLabel of controls) {
      await expect(page.getByRole('button', { name: controlLabel, exact: true })).toHaveAttribute(
        'aria-pressed',
        String(controlLabel === label),
      );
    }
    await expectInlineMargins(wrapper, margins[0], margins[1]);
  }

  await page.getByRole('button', { name: '서버에 저장' }).click();
  const savedHtml = page.getByLabel('서버 저장 HTML');
  await expect(savedHtml).toContainText('width="160"');
  await expect(savedHtml).toContainText('margin-left: auto');
  await expect(savedHtml).toContainText('margin-right: 0');

  await page.getByRole('button', { name: 'intro fixture 불러오기' }).click();
  await expect(editor).toContainText('음성인식(STT)은');
  await page.getByRole('button', { name: '저장값 다시 불러오기' }).click();

  await expect(image).toBeVisible();
  await expect(wrapper).toHaveCSS('width', '160px');
  await expectInlineMargins(wrapper, 'auto', '0px');
});
