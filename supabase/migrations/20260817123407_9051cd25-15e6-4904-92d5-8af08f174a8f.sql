CREATE POLICY "task_images_read_all" ON storage.objects FOR SELECT USING (bucket_id = 'task-images');
CREATE POLICY "task_images_upload_own" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'task-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "task_images_update_own" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'task-images' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "task_images_delete_own" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'task-images' AND (storage.foldername(name))[1] = auth.uid()::text);