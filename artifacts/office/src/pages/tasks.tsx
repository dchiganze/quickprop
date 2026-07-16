import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useListTasks,
  useCreateTask,
  useUpdateTask,
  useDeleteTask,
  useListUsers,
  getListTasksQueryKey,
  Task,
} from '@workspace/api-client-react';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, AlertCircle, Plus, User, CheckSquare, Trash2 } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

function TaskRow({ task, onToggle, onDelete }: { task: Task; onToggle: (task: Task) => void; onDelete: (task: Task) => void }) {
  const isOverdue = task.dueDate && isPast(new Date(task.dueDate)) && !isToday(new Date(task.dueDate)) && task.status !== 'done';
  const isDueToday = task.dueDate && isToday(new Date(task.dueDate)) && task.status !== 'done';

  return (
    <Card className={`mb-3 transition-colors group ${task.status === 'done' ? 'opacity-50' : 'hover:border-primary/50'}`} data-testid={`card-task-${task.id}`}>
      <CardContent className="p-4 flex items-center gap-4">
        <Checkbox
          checked={task.status === 'done'}
          onCheckedChange={() => onToggle(task)}
          className="w-5 h-5 rounded-full"
          data-testid={`checkbox-task-${task.id}`}
        />

        <div className="flex-1 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`font-semibold text-sm ${task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                {task.title}
              </h4>
              {(task.priority === 'high' || task.priority === 'urgent') && (
                <Badge variant="destructive" className="h-5 text-[10px] px-1.5 uppercase">{task.priority}</Badge>
              )}
            </div>
            {task.description && <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>}

            <div className="flex flex-wrap items-center gap-3 mt-2 text-xs font-medium">
              {task.type && (
                <span className="text-primary bg-primary/10 px-1.5 py-0.5 rounded capitalize">
                  {task.type.replace('_', ' ')}
                </span>
              )}
              {task.dueDate && (
                <span className={`flex items-center gap-1 ${isOverdue ? 'text-destructive' : isDueToday ? 'text-amber-600' : 'text-muted-foreground'}`}>
                  {isOverdue ? <AlertCircle className="w-3.5 h-3.5" /> : <Calendar className="w-3.5 h-3.5" />}
                  {isOverdue ? 'Overdue' : isDueToday ? 'Today' : format(new Date(task.dueDate), 'MMM d, yyyy')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="w-7 h-7 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-bold text-muted-foreground">
              <User className="w-3 h-3" />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
              onClick={() => onDelete(task)}
              data-testid={`button-delete-task-${task.id}`}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Tasks() {
  const { data: tasks, isLoading } = useListTasks();
  const { data: users } = useListUsers();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', dueDate: '', assigneeId: '' });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: getListTasksQueryKey() });

  const createTask = useCreateTask({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: 'Task created' });
        setOpen(false);
        setForm({ title: '', description: '', priority: 'medium', dueDate: '', assigneeId: '' });
      },
      onError: () => toast({ title: 'Could not create task', variant: 'destructive' }),
    },
  });
  const updateTask = useUpdateTask({ mutation: { onSuccess: invalidate } });
  const deleteTask = useDeleteTask({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast({ title: 'Task deleted' });
      },
    },
  });

  const submit = () => {
    if (!form.title) {
      toast({ title: 'Title is required', variant: 'destructive' });
      return;
    }
    createTask.mutate({
      data: {
        title: form.title,
        description: form.description || undefined,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        assigneeId: form.assigneeId ? Number(form.assigneeId) : undefined,
      },
    });
  };

  const toggle = (task: Task) =>
    updateTask.mutate({ id: task.id, data: { status: task.status === 'done' ? 'open' : 'done' } });
  const remove = (task: Task) => deleteTask.mutate({ id: task.id });

  return (
    <div className="p-8 max-w-[1000px] mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground mt-1">Manage your agency to-dos and follow-ups.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-sm" data-testid="button-add-task">
              <Plus className="w-4 h-4 mr-2" />
              Add Task
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>New Task</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label htmlFor="task-title">Title</Label>
                <Input id="task-title" data-testid="input-task-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Follow up with buyer" />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="task-desc">Description</Label>
                <Textarea id="task-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Priority</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {['low', 'medium', 'high', 'urgent'].map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="task-due">Due Date</Label>
                  <Input id="task-due" type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Assignee</Label>
                <Select value={form.assigneeId} onValueChange={(v) => setForm({ ...form, assigneeId: v })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    {users?.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit} disabled={createTask.isPending} data-testid="button-save-task">
                {createTask.isPending ? 'Creating...' : 'Create Task'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-8">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full mb-3" />)
        ) : tasks?.length === 0 ? (
          <div className="text-center py-16 bg-card rounded-lg border border-dashed">
            <CheckSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-1">All caught up!</h3>
            <p className="text-muted-foreground">You have no pending tasks.</p>
          </div>
        ) : (
          <div>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4">Pending</h3>
            {tasks?.filter((t) => t.status !== 'done').map((task) => (
              <TaskRow key={task.id} task={task} onToggle={toggle} onDelete={remove} />
            ))}

            <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-4 mt-8">Completed</h3>
            {tasks?.filter((t) => t.status === 'done').map((task) => (
              <TaskRow key={task.id} task={task} onToggle={toggle} onDelete={remove} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
